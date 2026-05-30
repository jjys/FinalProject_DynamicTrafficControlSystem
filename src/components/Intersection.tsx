import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box, Plane } from '@react-three/drei';
import type { Car, Node } from '../models/TrafficSimulation';

interface CityNetworkProps {
  cars: Car[];
  nodes: Node[];
}

const CarMesh = ({ car }: { car: Car }) => {
  const laneWidth = 4;
  let position: [number, number, number] = [car.x, 0.5, car.z];
  let rotation: [number, number, number] = [0, 0, 0];
  
  if (car.fromDirection === 'N') {
    rotation = [0, 0, 0]; // Heading South
  } else if (car.fromDirection === 'S') {
    rotation = [0, Math.PI, 0]; // Heading North
  } else if (car.fromDirection === 'W') {
    rotation = [0, -Math.PI / 2, 0]; // Heading East
  } else if (car.fromDirection === 'E') {
    rotation = [0, Math.PI / 2, 0]; // Heading West
  }

  const color = useMemo(() => {
    if (car.isEmergency) return '#ff1111'; // Emergency Red
    const colors = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#2ecc71', '#e67e22'];
    const idx = parseInt(car.id.split('-')[1] || '0') % colors.length;
    return colors[idx];
  }, [car.id, car.isEmergency]);

  // Phase 3: Emergency Vehicle Visuals
  const isEm = car.isEmergency;
  
  return (
    <Box position={position} rotation={rotation} args={[2, 1, 4]} castShadow>
      <meshStandardMaterial 
        color={color} 
        emissive={isEm ? "#ff0000" : "#000"} 
        emissiveIntensity={isEm ? (Date.now() % 500 < 250 ? 5 : 0) : 0} 
      />
    </Box>
  );
};

const TrafficLight = ({ position, rotation = [0, 0, 0], isGreen }: { position: [number, number, number], rotation?: [number, number, number], isGreen: boolean }) => {
  return (
    <group position={position} rotation={rotation}>
      <Box position={[0, 4, 0]} args={[1, 3, 1]}>
        <meshStandardMaterial color="#333" />
      </Box>
      <Box position={[0, 2, 0]} args={[0.5, 4, 0.5]}>
        <meshStandardMaterial color="#555" />
      </Box>
      <mesh position={[0, 4.5, 0.6]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial color={isGreen ? "#111" : "#e74c3c"} emissive={isGreen ? "#000" : "#e74c3c"} emissiveIntensity={2} />
      </mesh>
      <mesh position={[0, 3.5, 0.6]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial color={isGreen ? "#2ecc71" : "#111"} emissive={isGreen ? "#2ecc71" : "#000"} emissiveIntensity={2} />
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
  const nsStraightGreen = node.phase === 0;
  const nsLeftGreen = node.phase === 1;
  const ewStraightGreen = node.phase === 2;
  const ewLeftGreen = node.phase === 3;

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
      <TrafficLight position={[-8, 0, -10]} rotation={[0, Math.PI, 0]} isGreen={nsStraightGreen} /> {/* Straight */}
      <TrafficLight position={[-2, 0, -10]} rotation={[0, Math.PI, 0]} isGreen={nsLeftGreen} />     {/* Left */}
      
      {/* Coming from South (facing South) */}
      <TrafficLight position={[8, 0, 10]} rotation={[0, 0, 0]} isGreen={nsStraightGreen} />       {/* Straight */}
      <TrafficLight position={[2, 0, 10]} rotation={[0, 0, 0]} isGreen={nsLeftGreen} />         {/* Left */}
      
      {/* E-W Lights */}
      {/* Coming from West (facing West) */}
      <TrafficLight position={[-10, 0, 8]} rotation={[0, -Math.PI / 2, 0]} isGreen={ewStraightGreen} /> {/* Straight */}
      <TrafficLight position={[-10, 0, 2]} rotation={[0, -Math.PI / 2, 0]} isGreen={ewLeftGreen} />     {/* Left */}
      
      {/* Coming from East (facing East) */}
      <TrafficLight position={[10, 0, -8]} rotation={[0, Math.PI / 2, 0]} isGreen={ewStraightGreen} />  {/* Straight */}
      <TrafficLight position={[10, 0, -2]} rotation={[0, Math.PI / 2, 0]} isGreen={ewLeftGreen} />      {/* Left */}
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
