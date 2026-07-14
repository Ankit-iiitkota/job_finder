"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import type { Mesh } from "three";

/**
 * Abstract animated 3D hero visual — a cluster of distorted, floating
 * shapes standing in for "jobs / resumes / offers in motion". Deliberately
 * self-contained: no external HDRI/texture fetches (drei's `Environment`
 * pulls one from a CDN), just three.js lights, so the hero never depends
 * on a third-party asset being reachable.
 *
 * Mounted via next/dynamic with `ssr: false` in the landing page — Canvas
 * needs a real WebGL context, which doesn't exist during SSR/RSC render.
 */
function Blob({
  position,
  color,
  scale = 1,
  speed = 1,
}: {
  position: [number, number, number];
  color: string;
  scale?: number;
  speed?: number;
}) {
  const meshRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x = state.clock.elapsedTime * 0.15 * speed;
    meshRef.current.rotation.y = state.clock.elapsedTime * 0.1 * speed;
  });

  return (
    <Float speed={speed * 1.4} rotationIntensity={0.6} floatIntensity={1.4}>
      <mesh ref={meshRef} position={position} scale={scale}>
        <icosahedronGeometry args={[1, 4]} />
        <MeshDistortMaterial
          color={color}
          speed={2}
          distort={0.35}
          radius={1}
          roughness={0.15}
          metalness={0.2}
        />
      </mesh>
    </Float>
  );
}

export function HeroScene() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 7], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 4, 4]} intensity={1.2} />
      <pointLight position={[-4, -2, -2]} intensity={0.6} color="#818cf8" />

      <Blob position={[-1.6, 0.6, 0]} color="#6366f1" scale={1.35} speed={0.9} />
      <Blob position={[1.8, -0.4, -1]} color="#22d3ee" scale={0.95} speed={1.2} />
      <Blob position={[0.3, 1.4, -2]} color="#a78bfa" scale={0.65} speed={1.5} />
    </Canvas>
  );
}
