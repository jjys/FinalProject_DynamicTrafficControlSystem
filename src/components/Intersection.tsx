import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Box, Plane } from '@react-three/drei';
import type { Car, Node } from '../models/TrafficSimulation';

interface CityNetworkProps {
  cars: Car[];
  nodes: Node[];
}

// Cache geometry and materials to prevent WebGL memory leaks (OOM)
const carGeometry = new THREE.BoxGeometry(2, 1, 4);
const colors = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#2ecc71', '#e67e22'];
const carMaterials = colors.map(c => new THREE.MeshStandardMaterial({ color: c }));
const emergencyMaterial = new THREE.MeshStandardMaterial({ color: "#ff1111", emissive: "#ff0000" });

const CarMesh = ({ car }: { car: Car }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame(() => {
    if (!meshRef.current) return;
    
    let rotationY = 0;
    if (car.fromDirection === 'N') {
      rotationY = 0;
    } else if (car.fromDirection === 'S') {
      rotationY = Math.PI;
    } else if (car.fromDirection === 'W') {
      rotationY = -Math.PI / 2;
    } else if (car.fromDirection === 'E') {
      rotationY = Math.PI / 2;
    }

    meshRef.current.position.set(car.x, 0.5, car.z);
    meshRef.current.rotation.set(0, rotationY, 0);

    if (car.isEmergency) {
      meshRef.current.material = emergencyMaterial;
      emergencyMaterial.emissiveIntensity = (Date.now() % 500 < 250 ? 5 : 0);
    } else {
      const idx = parseInt(car.id.split('-')[1] || '0') % carMaterials.length;
      meshRef.current.material = carMaterials[idx];
    }
  });
  
  const idx = parseInt(car.id.split('-')[1] || '0') % carMaterials.length;
  
  return (
    <mesh 
      ref={meshRef} 
      geometry={carGeometry}
      material={car.isEmergency ? emergencyMaterial : carMaterials[idx]}
      castShadow
    />
  );
};

const TrafficLight = ({ position, rotation, lightState }: { position: [number, number, number], rotation: [number, number, number], lightState: 'red' | 'yellow' | 'green' }) => {
  return (
    <group position={position} rotation={rotation}>
      <Box position={[0, 4.5, 0]} args={[1.2, 3.5, 1.0]}>
        <meshStandardMaterial color="#333" />
      </Box>
      <Box position={[0, 2, 0]} args={[0.5, 4, 0.5]}>
        <meshStandardMaterial color="#555" />
      </Box>
      <mesh position={[0, 5.5, 0.6]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color={lightState === 'red' ? "#e74c3c" : "#111"} emissive={lightState === 'red' ? "#e74c3c" : "#000"} emissiveIntensity={2} />
      </mesh>
      <mesh position={[0, 4.5, 0.6]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color={lightState === 'yellow' ? "#f1c40f" : "#111"} emissive={lightState === 'yellow' ? "#f1c40f" : "#000"} emissiveIntensity={2} />
      </mesh>
      <mesh position={[0, 3.5, 0.6]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color={lightState === 'green' ? "#2ecc71" : "#111"} emissive={lightState === 'green' ? "#2ecc71" : "#000"} emissiveIntensity={2} />
      </mesh>
    </group>
  );
};

const StopLine = ({ position, rotation }: { position: [number, number, number], rotation: [number, number, number] }) => (
  <Plane args={[10, 1]} position={position} rotation={rotation} receiveShadow>
    <meshStandardMaterial color="#ecf0f1" />
  </Plane>
);

const IntersectionNode = ({ node }: { node: Node }) => {
  const isYellow = node.yellowTimer !== undefined && node.yellowTimer > 0;
  
  const getLightState = (phaseMatch: boolean): 'red' | 'yellow' | 'green' => {
      if (phaseMatch) {
          return isYellow ? 'yellow' : 'green';
      }
      return 'red';
  };

  const nsStraightState = getLightState(node.phase === 0);
  const nsLeftState = getLightState(node.phase === 1);
  const ewStraightState = getLightState(node.phase === 2);
  const ewLeftState = getLightState(node.phase === 3);

  return (
    <group position={[node.x, 0, node.z]}>
      {/* Center Intersection mark */}
      <Plane args={[20, 20]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <meshStandardMaterial color="#3b5269" />
      </Plane>
      
      {/* Stop Lines */}
      {/* North side (heading South, lanes are on the right/West: x = -10 to 0) center is x=-5 */}
      <StopLine position={[-5, 0.04, -10]} rotation={[-Math.PI / 2, 0, 0]} />
      {/* South side (heading North, lanes are on the right/East: x = 0 to 10) center is x=5 */}
      <StopLine position={[5, 0.04, 10]} rotation={[-Math.PI / 2, 0, 0]} />
      {/* West side (heading East, lanes are on the right/South: z = 0 to 10) center is z=5 */}
      <StopLine position={[-10, 0.04, 5]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} />
      {/* East side (heading West, lanes are on the right/North: z = -10 to 0) center is z=-5 */}
      <StopLine position={[10, 0.04, -5]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} />

      {/* N-S Lights */}
      {/* Coming from North (facing North) */}
      <TrafficLight position={[-8, 0, -10]} rotation={[0, Math.PI, 0]} lightState={nsStraightState} /> {/* Straight */}
      <TrafficLight position={[-2, 0, -10]} rotation={[0, Math.PI, 0]} lightState={nsLeftState} />     {/* Left */}
      
      {/* Coming from South (facing South) */}
      <TrafficLight position={[8, 0, 10]} rotation={[0, 0, 0]} lightState={nsStraightState} />       {/* Straight */}
      <TrafficLight position={[2, 0, 10]} rotation={[0, 0, 0]} lightState={nsLeftState} />         {/* Left */}
      
      {/* E-W Lights */}
      {/* Coming from West (facing West) */}
      <TrafficLight position={[-10, 0, 8]} rotation={[0, -Math.PI / 2, 0]} lightState={ewStraightState} /> {/* Straight */}
      <TrafficLight position={[-10, 0, 2]} rotation={[0, -Math.PI / 2, 0]} lightState={ewLeftState} />     {/* Left */}
      
      {/* Coming from East (facing East) */}
      <TrafficLight position={[10, 0, -8]} rotation={[0, Math.PI / 2, 0]} lightState={ewStraightState} />  {/* Straight */}
      <TrafficLight position={[10, 0, -2]} rotation={[0, Math.PI / 2, 0]} lightState={ewLeftState} />      {/* Left */}
    </group>
  );
};

export const Intersection: React.FC<CityNetworkProps> = ({ cars, nodes }) => {
  return (
    <div style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }}>
      <Canvas shadows camera={{ position: [0, 250, 250], fov: 45 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[50, 150, 50]} castShadow intensity={0.8} shadow-camera-far={500} shadow-camera-left={-200} shadow-camera-right={200} shadow-camera-top={200} shadow-camera-bottom={-200} />
        
        {/* Ground */}
        <Plane args={[400, 400]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <meshStandardMaterial color="#2c3e50" />
        </Plane>
        
        {/* Phase 3: 3x3 Main Roads (Grid) */}
        {/* Vertical Roads at -100, 0, 100 */}
        {[-100, 0, 100].map(x => (
            <Plane key={`vroad-${x}`} args={[20, 400]} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, 0]} receiveShadow>
              <meshStandardMaterial color="#34495e" />
            </Plane>
        ))}
        
        {/* Horizontal Roads at -100, 0, 100 */}
        {[-100, 0, 100].map(z => (
            <Plane key={`hroad-${z}`} args={[400, 20]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, z]} receiveShadow>
              <meshStandardMaterial color="#34495e" />
            </Plane>
        ))}

        {/* Intersection Nodes */}
        {nodes.map(node => (
          <IntersectionNode key={node.id} node={node} />
        ))}

        {/* Cars */}
        {cars.map(car => (
          <CarMesh key={car.id} car={car} />
        ))}

        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} />
      </Canvas>
    </div>
  );
};
