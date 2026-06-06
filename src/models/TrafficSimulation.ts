export type Direction = 'N' | 'S' | 'E' | 'W';

export interface Node {
  id: string;
  x: number;
  z: number;
  phase: number; // 0 for N-S, 1 for E-W
  nextPhase?: number;
  yellowTimer?: number;
}

export interface Car {
  id: string;
  x: number;
  z: number;
  speed: number;
  waiting: boolean;
  waitTime: number; // Time spent waiting/stuck
  targetNodeId?: string; // Node ID it is currently heading towards
  fromDirection: Direction; // N, S, W, E
  intendedTurn: 'straight' | 'left' | 'right';
  isEmergency?: boolean;
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
    { id: 'n00', x: -100, z: -100 },
    { id: 'n10', x: 0, z: -100 },
    { id: 'n20', x: 100, z: -100 },
    { id: 'n01', x: -100, z: 0 },
    { id: 'n11', x: 0, z: 0 },
    { id: 'n21', x: 100, z: 0 },
    { id: 'n02', x: -100, z: 100 },
    { id: 'n12', x: 0, z: 100 },
    { id: 'n22', x: 100, z: 100 },
  ];
  
  // Define external entry points mapping to first node and direction it comes from
  private entryPoints = [
    { startX: -100, startZ: -250, targetId: 'n00', fromDir: 'N' },
    { startX: 0, startZ: -250, targetId: 'n10', fromDir: 'N' },
    { startX: 100, startZ: -250, targetId: 'n20', fromDir: 'N' },
    
    { startX: -100, startZ: 250, targetId: 'n02', fromDir: 'S' },
    { startX: 0, startZ: 250, targetId: 'n12', fromDir: 'S' },
    { startX: 100, startZ: 250, targetId: 'n22', fromDir: 'S' },
    
    { startX: -250, startZ: -100, targetId: 'n00', fromDir: 'W' },
    { startX: -250, startZ: 0, targetId: 'n01', fromDir: 'W' },
    { startX: -250, startZ: 100, targetId: 'n02', fromDir: 'W' },
    
    { startX: 250, startZ: -100, targetId: 'n20', fromDir: 'E' },
    { startX: 250, startZ: 0, targetId: 'n21', fromDir: 'E' },
    { startX: 250, startZ: 100, targetId: 'n22', fromDir: 'E' },
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
        if (n.yellowTimer !== undefined && n.yellowTimer > 0) {
            n.yellowTimer -= deltaTime;
            if (n.yellowTimer <= 0) {
                if (n.nextPhase !== undefined) {
                    n.phase = n.nextPhase;
                    n.nextPhase = undefined;
                }
                n.yellowTimer = 0;
            }
        }
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

      if (!isRedLight && node.yellowTimer !== undefined && node.yellowTimer > 0) {
          let distToStopLine = distToIntersection - this.stoppingDistance;
          if (distToStopLine > 10) {
              targetSpeed = this.maxSpeed * 0.5; // Decelerate on yellow if far enough
          }
      }

      // Yellow light clearance: If the light just turned red but we are moving and are too close to stop (within 6 units of the stop line), just clear the intersection!
      // Also, if the car's front has already passed the stop line (distToStopLine < 0), it MUST clear the intersection!
      if (isRedLight && distToIntersection > 0) {
          let distToStopLine = distToIntersection - this.stoppingDistance;
          if (distToStopLine < 0) {
              isRedLight = false; // Already passed the stop line, keep going!
          } else if (distToStopLine < 6 && car.speed > 0.1) {
              isRedLight = false; // Dilemma zone, keep going!
          }
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
      const accelStep = this.acceleration * deltaTime * 60;
      if (car.speed < targetSpeed) {
        car.speed = Math.min(targetSpeed, car.speed + accelStep);
      } else if (car.speed > targetSpeed) {
        // Brake harder than accelerate
        car.speed = Math.max(targetSpeed, car.speed - accelStep * 4);
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

    // 3. Remove cars that went off map or have been stuck for > 60 seconds (God Hand)
    this.cars = this.cars.filter(car => Math.abs(car.x) < 280 && Math.abs(car.z) < 280 && car.waitTime < 60);
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

  private getAdjacentNode(node: {x:number, z:number}, dir: Direction): string | undefined {
      let target = undefined;
      let minDist = Infinity;
      for (let n of this.nodePositions) {
          if (dir === 'N' && n.x === node.x && n.z < node.z && (node.z - n.z) < minDist) { target = n.id; minDist = node.z - n.z; }
          if (dir === 'S' && n.x === node.x && n.z > node.z && (n.z - node.z) < minDist) { target = n.id; minDist = n.z - node.z; }
          if (dir === 'W' && n.z === node.z && n.x < node.x && (node.x - n.x) < minDist) { target = n.id; minDist = node.x - n.x; }
          if (dir === 'E' && n.z === node.z && n.x > node.x && (n.x - node.x) < minDist) { target = n.id; minDist = n.x - node.x; }
      }
      return target;
  }

  private decideNextTarget(car: Car, currentNode: Node) {
    // Phase 3 Bugfix: Snap to center to prevent crooked driving
    car.x = currentNode.x;
    car.z = currentNode.z;
    
    let nextNodeId = undefined;
    let newDir = car.fromDirection;
    
    if (car.fromDirection === 'N') {
        if (car.intendedTurn === 'straight') { nextNodeId = this.getAdjacentNode(currentNode, 'S'); newDir = 'N'; }
        else if (car.intendedTurn === 'left') { nextNodeId = this.getAdjacentNode(currentNode, 'E'); newDir = 'W'; }
        else if (car.intendedTurn === 'right') { nextNodeId = this.getAdjacentNode(currentNode, 'W'); newDir = 'E'; }
    } else if (car.fromDirection === 'S') {
        if (car.intendedTurn === 'straight') { nextNodeId = this.getAdjacentNode(currentNode, 'N'); newDir = 'S'; }
        else if (car.intendedTurn === 'left') { nextNodeId = this.getAdjacentNode(currentNode, 'W'); newDir = 'E'; }
        else if (car.intendedTurn === 'right') { nextNodeId = this.getAdjacentNode(currentNode, 'E'); newDir = 'W'; }
    } else if (car.fromDirection === 'W') {
        if (car.intendedTurn === 'straight') { nextNodeId = this.getAdjacentNode(currentNode, 'E'); newDir = 'W'; }
        else if (car.intendedTurn === 'left') { nextNodeId = this.getAdjacentNode(currentNode, 'S'); newDir = 'N'; }
        else if (car.intendedTurn === 'right') { nextNodeId = this.getAdjacentNode(currentNode, 'N'); newDir = 'S'; }
    } else if (car.fromDirection === 'E') {
        if (car.intendedTurn === 'straight') { nextNodeId = this.getAdjacentNode(currentNode, 'W'); newDir = 'E'; }
        else if (car.intendedTurn === 'left') { nextNodeId = this.getAdjacentNode(currentNode, 'N'); newDir = 'S'; }
        else if (car.intendedTurn === 'right') { nextNodeId = this.getAdjacentNode(currentNode, 'S'); newDir = 'N'; }
    }

    car.fromDirection = newDir;
    car.intendedTurn = this.pickTurn();
    
    // Apply lane offset for the new direction
    const laneOffset = car.intendedTurn === 'left' ? 2 : 6;
    if (newDir === 'N') car.x -= laneOffset;
    if (newDir === 'S') car.x += laneOffset;
    if (newDir === 'W') car.z += laneOffset;
    if (newDir === 'E') car.z -= laneOffset;

    car.targetNodeId = nextNodeId; // if undefined, it will just drive off screen
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

    // Check collision at spawn (only check cars in the same lane)
    for (let c of this.cars) {
        if (entry.fromDir === 'N' || entry.fromDir === 'S') {
            if (Math.abs(c.x - sx) < 1 && Math.abs(c.z - sz) < this.safeDistance) return null;
        } else {
            if (Math.abs(c.z - sz) < 1 && Math.abs(c.x - sx) < this.safeDistance) return null;
        }
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
      intendedTurn: intendedTurn,
      isEmergency: Math.random() < 0.02
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
    
    // Phase 3: Strict Adjacent Neighbors State Augmentation + Emergency Vehicle Flag
    const nodePos = this.nodePositions.find(n => n.id === nodeId)!;
    const nN = this.nodes.get(this.getAdjacentNode(nodePos, 'N') || '')?.phase || -1;
    const nS = this.nodes.get(this.getAdjacentNode(nodePos, 'S') || '')?.phase || -1;
    const nE = this.nodes.get(this.getAdjacentNode(nodePos, 'E') || '')?.phase || -1;
    const nW = this.nodes.get(this.getAdjacentNode(nodePos, 'W') || '')?.phase || -1;

    let emergencyPhase = 0;
    for (let c of this.cars) {
        if (c.targetNodeId === nodeId && c.isEmergency && this.distTo(c, nodePos) < 50) {
            if (c.fromDirection === 'N' || c.fromDirection === 'S') {
                emergencyPhase = c.intendedTurn === 'left' ? 2 : 1; // 1 = Phase 0, 2 = Phase 1
            } else {
                emergencyPhase = c.intendedTurn === 'left' ? 4 : 3; // 3 = Phase 2, 4 = Phase 3
            }
            break;
        }
    }
    
    return [node.phase, d(nsStraight), d(nsLeft), d(ewStraight), d(ewLeft), nN, nS, nE, nW, emergencyPhase];
  }
  
  // Phase 3 helper for distance
  private distTo(car: Car, node: {x:number, z:number}) {
      return Math.abs(car.x - node.x) + Math.abs(car.z - node.z);
  }

  // Get strict adjacent neighbors for reward blending
  public getAdjacentNeighbors(nodeId: string): string[] {
      const nodePos = this.nodePositions.find(n => n.id === nodeId)!;
      const neighbors = [];
      const nN = this.getAdjacentNode(nodePos, 'N'); if (nN) neighbors.push(nN);
      const nS = this.getAdjacentNode(nodePos, 'S'); if (nS) neighbors.push(nS);
      const nE = this.getAdjacentNode(nodePos, 'E'); if (nE) neighbors.push(nE);
      const nW = this.getAdjacentNode(nodePos, 'W'); if (nW) neighbors.push(nW);
      return neighbors;
  }

  // Get reward for a specific node
  public getNodeReward(nodeId: string): number {
    let waitingCars = 0;
    let emergencyWaiting = false;
    for (let c of this.cars) {
       if (c.targetNodeId === nodeId && (c.waiting || c.speed < 0.1)) {
           waitingCars++;
           if (c.isEmergency) emergencyWaiting = true;
       }
    }
    const passed = this.carsPassed.get(nodeId) || 0;
    let reward = (passed * 5) - waitingCars;
    if (emergencyWaiting) reward -= 50; // Harsh penalty for blocking emergency
    return reward;
  }

  public resetCarsPassed(nodeId: string): void {
    this.carsPassed.set(nodeId, 0);
  }

  public applyAction(nodeId: string, action: number) {
      const node = this.nodes.get(nodeId);
      if (node) {
          if (action === 1 && (node.yellowTimer === undefined || node.yellowTimer <= 0)) {
              node.nextPhase = (node.phase + 1) % 4;
              node.yellowTimer = 2.0; // 2 seconds yellow light
              this.timeInPhase.set(nodeId, 0);
          } else if (action === 1 && node.yellowTimer !== undefined && node.yellowTimer > 0) {
              // Ignore action if already transitioning
          } else if (action === 0) {
              // Do nothing, just accumulate timeInPhase
          }
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
