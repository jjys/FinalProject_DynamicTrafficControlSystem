export type Direction = 'N' | 'S' | 'E' | 'W';

export interface Node {
  id: string;
  x: number;
  z: number;
  phase: number; // 0 for N-S, 1 for E-W
}

export interface Car {
  id: string;
  x: number;
  z: number;
  speed: number;
  waiting: boolean;
  waitTime: number; // Time spent waiting/stuck
  targetNodeId: string | null; // Next node it's heading to
  fromDirection: Direction; // The direction it comes FROM into the target node
  intendedTurn: 'straight' | 'left' | 'right';
}

export class TrafficSimulation {
  public cars: Car[] = [];
  public nodes: Map<string, Node> = new Map();
  public timeInPhase: Map<string, number> = new Map();
  public carsPassed: Map<string, number> = new Map();
  public totalNetworkCarsPassed: number = 0;
  
  public spawnRate: number = 0.02;
  
  // A/B Testing Deterministic Replay
  public elapsedTime: number = 0;
  public recordScenario: boolean = false;
  public recordedScenario: { time: number, entryIndex: number, turn: 'straight'|'left'|'right' }[] = [];
  public replayScenario: { time: number, entryIndex: number, turn: 'straight'|'left'|'right' }[] | null = null;
  private replayIndex: number = 0;
  
  private maxSpeed = 1.0;
  private acceleration = 0.05;
  private stoppingDistance = 12; // Distance from center of node to stop
  private safeDistance = 6;
  private carIdCounter = 0;
  
  private nodePositions = [
    { id: 'n00', x: -50, z: -50 },
    { id: 'n10', x: 50, z: -50 },
    { id: 'n01', x: -50, z: 50 },
    { id: 'n11', x: 50, z: 50 },
  ];
  
  // Define external entry points mapping to first node and direction it comes from
  private entryPoints = [
    { startX: -50, startZ: -100, targetId: 'n00', fromDir: 'N' },
    { startX: 50, startZ: -100, targetId: 'n10', fromDir: 'N' },
    { startX: -50, startZ: 100, targetId: 'n01', fromDir: 'S' },
    { startX: 50, startZ: 100, targetId: 'n11', fromDir: 'S' },
    { startX: -100, startZ: -50, targetId: 'n00', fromDir: 'W' },
    { startX: -100, startZ: 50, targetId: 'n01', fromDir: 'W' },
    { startX: 100, startZ: -50, targetId: 'n10', fromDir: 'E' },
    { startX: 100, startZ: 50, targetId: 'n11', fromDir: 'E' },
  ] as const;

  constructor() {
    this.nodePositions.forEach(n => {
      this.nodes.set(n.id, { ...n, phase: 0 });
      this.timeInPhase.set(n.id, 0);
      this.carsPassed.set(n.id, 0);
    });
    // Reset stats but KEEP scenario settings
    this.elapsedTime = 0;
    this.replayIndex = 0;
    this.totalNetworkCarsPassed = 0;
  }

  public tick(deltaTime: number): void {
    this.elapsedTime += deltaTime;

    // 1. Spawn cars
    if (this.replayScenario) {
        while (this.replayIndex < this.replayScenario.length && this.replayScenario[this.replayIndex].time <= this.elapsedTime) {
            const ev = this.replayScenario[this.replayIndex];
            this.spawnCarSpecific(ev.entryIndex, ev.turn);
            this.replayIndex++;
        }
    } else {
        if (Math.random() < this.spawnRate * deltaTime * 60) {
          const spawned = this.spawnCar();
          if (this.recordScenario && spawned) {
              this.recordedScenario.push({ time: this.elapsedTime, entryIndex: spawned.entryIndex, turn: spawned.intendedTurn });
          }
        }
    }

    // Update node timers
    this.nodes.forEach(n => {
        this.timeInPhase.set(n.id, this.timeInPhase.get(n.id)! + deltaTime);
    });

    // 2. Update cars
    for (let i = 0; i < this.cars.length; i++) {
      let car = this.cars[i];
      let targetSpeed = this.maxSpeed;
      car.waiting = false;

      if (!car.targetNodeId) {
          // Car is leaving the map, just keep driving
          this.moveCar(car, targetSpeed, deltaTime);
          continue;
      }

      const node = this.nodes.get(car.targetNodeId)!;
      let isRedLight = true;
      if (car.fromDirection === 'N' || car.fromDirection === 'S') {
          if (car.intendedTurn === 'left' && node.phase === 1) isRedLight = false;
          if (car.intendedTurn !== 'left' && node.phase === 0) isRedLight = false;
      } else {
          if (car.intendedTurn === 'left' && node.phase === 3) isRedLight = false;
          if (car.intendedTurn !== 'left' && node.phase === 2) isRedLight = false;
      }
      
      // Calculate distance to center of target node along the primary axis of travel
      let distToIntersection = 0;
      if (car.fromDirection === 'N') distToIntersection = node.z - car.z; // comes from North(-Z), heading South(+Z)
      else if (car.fromDirection === 'S') distToIntersection = car.z - node.z; // comes from South(+Z), heading North(-Z)
      else if (car.fromDirection === 'W') distToIntersection = node.x - car.x; // comes from West(-X), heading East(+X)
      else if (car.fromDirection === 'E') distToIntersection = car.x - node.x; // comes from East(+X), heading West(-X)

      // Yellow light clearance: If the light just turned red but we are going fast and are too close to stop (within 6 units of the stop line), just clear the intersection!
      if (isRedLight && car.speed > 0.6 && distToIntersection > 0 && (distToIntersection - this.stoppingDistance) < 6) {
          isRedLight = false;
      }

      // distToIntersection is positive if car hasn't reached the center yet
      let isBoxBlocked = false;
      // Only check box blocking if the car has NOT crossed the stop line yet
      if (!isRedLight && distToIntersection > this.stoppingDistance - 2 && distToIntersection < this.stoppingDistance + 20) {
          // 1. Check if the intersection box itself is blocked by any car that is stuck (waiting)
          for (let c of this.cars) {
              if (c.id !== car.id && c.waiting && Math.abs(c.x - node.x) < 9 && Math.abs(c.z - node.z) < 9) {
                  // Only consider cars strictly inside the physical 18x18 intersection box that are completely stuck
                  isBoxBlocked = true;
                  break;
              }
          }
          // 2. Check if the intended exit road is backed up into the intersection
          if (!isBoxBlocked) {
              isBoxBlocked = this.isExitBlocked(car, node);
          }
      }

      if (isRedLight && distToIntersection > 0 || (isBoxBlocked && distToIntersection > 0)) {
        let distToStopLine = distToIntersection - this.stoppingDistance;
        
        if (distToStopLine < 0 && distToIntersection > 2) {
            // Overshot the stop line slightly while trying to stop, force it to stay stopped before reaching the center
            targetSpeed = 0;
            car.speed = 0;
            car.waiting = true;
        } else if (distToStopLine >= 0 && distToStopLine < 40) {
            // Approaching the stop line, decelerate smoothly
            targetSpeed = Math.max(0, distToStopLine * 0.05);
            if (targetSpeed < 0.1) {
                targetSpeed = 0;
                car.waiting = true;
            }
        }
      }

      // Check car in front (very basic collision detection)
      const carInFront = this.getCarInFront(car);
      if (carInFront) {
        const distToCar = Math.abs(carInFront.x - car.x) + Math.abs(carInFront.z - car.z);
        if (distToCar < this.safeDistance * 2) {
            const followSpeed = Math.max(0, (distToCar - this.safeDistance) * 0.1);
            targetSpeed = Math.min(targetSpeed, followSpeed);
            if (targetSpeed < 0.1) {
                targetSpeed = 0;
                car.waiting = true;
            }
        }
      }

      // Accelerate/Decelerate
      if (car.speed < targetSpeed) {
        car.speed = Math.min(targetSpeed, car.speed + this.acceleration);
      } else if (car.speed > targetSpeed) {
        // Brake harder than accelerate
        car.speed = Math.max(targetSpeed, car.speed - this.acceleration * 4);
      }

      // Move car
      this.moveCar(car, car.speed, deltaTime);

      // Check if car reached intersection center to decide next turn
      if (Math.abs(distToIntersection) < 2) {
         this.carsPassed.set(node.id, (this.carsPassed.get(node.id) || 0) + 1);
         this.totalNetworkCarsPassed++;
         this.decideNextTarget(car, node);
      }
      
      // Update wait time at the end of the frame
      if (car.waiting || car.speed < 0.1) {
          car.waitTime += deltaTime;
      } else {
          car.waitTime = 0;
      }
    }

    // 3. Remove cars that went off map or have been stuck for > 30 seconds (God Hand)
    this.cars = this.cars.filter(car => Math.abs(car.x) < 150 && Math.abs(car.z) < 150 && car.waitTime < 30);
  }

  private moveCar(car: Car, speed: number, dt: number) {
      const step = speed * dt * 60;
      if (car.fromDirection === 'N') car.z += step; // heading South
      if (car.fromDirection === 'S') car.z -= step; // heading North
      if (car.fromDirection === 'W') car.x += step; // heading East
      if (car.fromDirection === 'E') car.x -= step; // heading West
  }

  private pickTurn(): 'straight' | 'left' | 'right' {
    const rand = Math.random();
    if (rand > 0.6 && rand <= 0.8) return 'left';
    if (rand > 0.8) return 'right';
    return 'straight';
  }

  private decideNextTarget(car: Car, currentNode: Node) {
    // Snap to center to avoid drifting
    car.x = currentNode.x;
    car.z = currentNode.z;
    
    const turn = car.intendedTurn;

    // Map turn to new fromDirection
    let newDir = car.fromDirection; // straight keeps same fromDir
    if (turn === 'left') {
        if (car.fromDirection === 'N') newDir = 'W'; // Going S, turn left -> going E (comes from W)
        else if (car.fromDirection === 'S') newDir = 'E'; // Going N, turn left -> going W (comes from E)
        else if (car.fromDirection === 'W') newDir = 'S'; // Going E, turn left -> going N (comes from S)
        else if (car.fromDirection === 'E') newDir = 'N'; // Going W, turn left -> going S (comes from N)
    } else if (turn === 'right') {
        if (car.fromDirection === 'N') newDir = 'E'; // Going S, turn right -> going W (comes from E)
        else if (car.fromDirection === 'S') newDir = 'W'; // Going N, turn right -> going E (comes from W)
        else if (car.fromDirection === 'W') newDir = 'N'; // Going E, turn right -> going S (comes from N)
        else if (car.fromDirection === 'E') newDir = 'S'; // Going W, turn right -> going N (comes from S)
    }
    
    car.fromDirection = newDir;
    
    // Apply lane offset for the new direction based on NEXT intended turn
    car.intendedTurn = this.pickTurn();
    const laneOffset = car.intendedTurn === 'left' ? 2 : 6;
    if (newDir === 'N') car.x -= laneOffset;
    if (newDir === 'S') car.x += laneOffset;
    if (newDir === 'W') car.z += laneOffset; // driving East, right side is +Z
    if (newDir === 'E') car.z -= laneOffset; // driving West, right side is -Z
    
    // Find next node based on new heading
    let nextNodeId = null;
    if (car.fromDirection === 'N') {
        // going South (+Z). Need node with same X, larger Z
        const next = this.nodePositions.find(n => n.x === currentNode.x && n.z > currentNode.z);
        if (next) nextNodeId = next.id;
    } else if (car.fromDirection === 'S') {
        // going North (-Z)
        const next = this.nodePositions.find(n => n.x === currentNode.x && n.z < currentNode.z);
        if (next) nextNodeId = next.id;
    } else if (car.fromDirection === 'W') {
        // going East (+X)
        const next = this.nodePositions.find(n => n.z === currentNode.z && n.x > currentNode.x);
        if (next) nextNodeId = next.id;
    } else if (car.fromDirection === 'E') {
        // going West (-X)
        const next = this.nodePositions.find(n => n.z === currentNode.z && n.x < currentNode.x);
        if (next) nextNodeId = next.id;
    }

    car.targetNodeId = nextNodeId; // if null, it will just drive off screen
  }

  private spawnCarSpecific(entryIndex: number, intendedTurn: 'straight' | 'left' | 'right') {
    const entry = this.entryPoints[entryIndex];
    let sx = entry.startX;
    let sz = entry.startZ;
    const laneOffset = intendedTurn === 'left' ? 2 : 6;
    
    if (entry.fromDir === 'N') sx -= laneOffset;
    if (entry.fromDir === 'S') sx += laneOffset;
    if (entry.fromDir === 'W') sz += laneOffset;
    if (entry.fromDir === 'E') sz -= laneOffset;

    // Check collision at spawn
    for (let c of this.cars) {
        if (Math.abs(c.x - sx) + Math.abs(c.z - sz) < this.safeDistance) return null;
    }

    const car: Car = {
      id: `car-${this.carIdCounter++}`,
      x: sx,
      z: sz,
      speed: this.maxSpeed,
      waiting: false,
      waitTime: 0,
      targetNodeId: entry.targetId,
      fromDirection: entry.fromDir,
      intendedTurn: intendedTurn
    };
    
    this.cars.push(car);
    return { entryIndex, intendedTurn };
  }

  private spawnCar() {
    const entryIndex = Math.floor(Math.random() * this.entryPoints.length);
    const intendedTurn = this.pickTurn();
    return this.spawnCarSpecific(entryIndex, intendedTurn);
  }

  private isExitBlocked(car: Car, node: Node): boolean {
    let newDir = car.fromDirection;
    if (car.intendedTurn === 'left') {
        if (car.fromDirection === 'N') newDir = 'W';
        else if (car.fromDirection === 'S') newDir = 'E';
        else if (car.fromDirection === 'W') newDir = 'S';
        else if (car.fromDirection === 'E') newDir = 'N';
    } else if (car.intendedTurn === 'right') {
        if (car.fromDirection === 'N') newDir = 'E';
        else if (car.fromDirection === 'S') newDir = 'W';
        else if (car.fromDirection === 'W') newDir = 'N';
        else if (car.fromDirection === 'E') newDir = 'S';
    }

    let closestDist = Infinity;
    for (let c of this.cars) {
      if (c.id === car.id) continue;
      // Find cars that are already on the intended exit road, moving away from this node
      if (c.fromDirection === newDir) {
          let distFromNode = -1;
          if (newDir === 'N' && c.z > node.z && Math.abs(c.x - node.x) < 15) distFromNode = c.z - node.z;
          else if (newDir === 'S' && c.z < node.z && Math.abs(c.x - node.x) < 15) distFromNode = node.z - c.z;
          else if (newDir === 'W' && c.x > node.x && Math.abs(c.z - node.z) < 15) distFromNode = c.x - node.x;
          else if (newDir === 'E' && c.x < node.x && Math.abs(c.z - node.z) < 15) distFromNode = node.x - c.x;

          // If they are stuck (waiting)
          if (distFromNode > 0 && distFromNode < closestDist && c.waiting) {
              closestDist = distFromNode;
          }
      }
    }

    // If the closest stuck car is within 22 units of the center, the exit is blocked
    return closestDist < 22;
  }

  private getCarInFront(car: Car): Car | null {
    let closestDist = Infinity;
    let closestCar = null;
    for (let c of this.cars) {
      if (c.id !== car.id && c.fromDirection === car.fromDirection) {
        let dist = -1;
        // Check if `c` is ahead of `car`
        if (car.fromDirection === 'N' && c.z > car.z && Math.abs(c.x - car.x) < 2) dist = c.z - car.z;
        if (car.fromDirection === 'S' && c.z < car.z && Math.abs(c.x - car.x) < 2) dist = car.z - c.z;
        if (car.fromDirection === 'W' && c.x > car.x && Math.abs(c.z - car.z) < 2) dist = c.x - car.x;
        if (car.fromDirection === 'E' && c.x < car.x && Math.abs(c.z - car.z) < 2) dist = car.x - c.x;

        if (dist > 0 && dist < closestDist) {
          closestDist = dist;
          closestCar = c;
        }
      }
    }
    return closestCar;
  }

  // Get state for a specific node
  public getNodeState(nodeId: string): number[] {
    const node = this.nodes.get(nodeId)!;
    let nsStraight = 0, nsLeft = 0, ewStraight = 0, ewLeft = 0;
    
    for (let c of this.cars) {
      if (c.targetNodeId === nodeId && (c.waiting || c.speed < 0.1)) {
        if (c.fromDirection === 'N' || c.fromDirection === 'S') {
            if (c.intendedTurn === 'left') nsLeft++;
            else nsStraight++;
        } else {
            if (c.intendedTurn === 'left') ewLeft++;
            else ewStraight++;
        }
      }
    }
    const d = (count: number) => count === 0 ? 0 : (count <= 2 ? 1 : (count <= 5 ? 2 : 3));
    
    // Phase 2: State Augmentation (Green Wave)
    // Find neighbors based on grid position
    let neighbor1Phase = 0;
    let neighbor2Phase = 0;
    
    if (nodeId === 'n00') {
        neighbor1Phase = this.nodes.get('n10')?.phase || 0; // East
        neighbor2Phase = this.nodes.get('n01')?.phase || 0; // South
    } else if (nodeId === 'n10') {
        neighbor1Phase = this.nodes.get('n00')?.phase || 0; // West
        neighbor2Phase = this.nodes.get('n11')?.phase || 0; // South
    } else if (nodeId === 'n01') {
        neighbor1Phase = this.nodes.get('n11')?.phase || 0; // East
        neighbor2Phase = this.nodes.get('n00')?.phase || 0; // North
    } else if (nodeId === 'n11') {
        neighbor1Phase = this.nodes.get('n01')?.phase || 0; // West
        neighbor2Phase = this.nodes.get('n10')?.phase || 0; // North
    }

    return [node.phase, d(nsStraight), d(nsLeft), d(ewStraight), d(ewLeft), neighbor1Phase, neighbor2Phase];
  }

  // Get reward for a specific node
  public getNodeReward(nodeId: string): number {
    let waitingCars = 0;
    for (let c of this.cars) {
       if (c.targetNodeId === nodeId && (c.waiting || c.speed < 0.1)) {
           waitingCars++;
       }
    }
    const passed = this.carsPassed.get(nodeId) || 0;
    return (passed * 5) - waitingCars;
  }

  public resetCarsPassed(nodeId: string): void {
    this.carsPassed.set(nodeId, 0);
  }

  public applyAction(nodeId: string, action: number) {
    const node = this.nodes.get(nodeId)!;
    if (action === 1) {
        node.phase = (node.phase + 1) % 4;
        this.timeInPhase.set(nodeId, 0);
    }
  }

  public getGlobalStats() {
    let waiting = 0;
    for (let c of this.cars) {
        if (c.waiting || c.speed < 0.1) waiting++;
    }
    return {
        congestedVehicles: waiting,
        totalCars: this.cars.length,
        avgWaitTime: this.cars.length > 0 ? (waiting / this.cars.length).toFixed(2) : '0.00'
    };
  }
}
