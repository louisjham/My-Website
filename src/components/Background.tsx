import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';

// --- SHADERS ---

const sigilVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const sigilFragmentShader = `
  varying vec2 vUv;
  uniform float uTime;
  
  float ring(vec2 uv, float radius, float width) {
    float d = length(uv - 0.5);
    return smoothstep(width, 0.0, abs(d - radius));
  }

  void main() {
    vec2 uv = vUv;
    vec3 color = vec3(0.01, 0.05, 0.02); // Dark base
    
    // Circuitry-like lines
    float lines = sin(uv.x * 50.0 + uTime) * sin(uv.y * 50.0 - uTime);
    lines = step(0.98, lines);
    
    // Magical rings
    float r1 = ring(uv, 0.3, 0.002);
    float r2 = ring(uv, 0.35, 0.005);
    float r3 = ring(uv, 0.4, 0.001);
    
    // Rotating sigil details
    vec2 centered = uv - 0.5;
    float angle = atan(centered.y, centered.x) + uTime * 0.5;
    float dist = length(centered);
    float sigil = step(0.9, sin(angle * 8.0)) * step(0.2, dist) * step(dist, 0.3);
    
    vec3 accent = vec3(0.0, 1.0, 0.25); // Eldritch Green
    vec3 cyan = vec3(0.0, 0.9, 1.0);     // Sigil Cyan
    
    color += mix(vec3(0.0), accent, lines * 0.2);
    color += mix(vec3(0.0), cyan, r1 + r2 * 0.5 + r3);
    color += mix(vec3(0.0), accent, sigil * 0.3);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const morphVertexShader = `
  uniform float uTime;
  uniform float uMorph; // 0: Sphere, 1: Box, 2: Torus
  
  attribute vec3 positionBox;
  attribute vec3 positionTorus;
  
  varying vec2 vUv;
  varying float vDist;

  void main() {
    vUv = uv;
    
    vec3 targetPos;
    if (uMorph < 1.0) {
      targetPos = mix(position, positionBox, uMorph);
    } else {
      targetPos = mix(positionBox, positionTorus, uMorph - 1.0);
    }

    // Add some organic noise/wobble
    float wobble = sin(uTime * 2.0 + position.x * 5.0) * 0.1;
    targetPos += normal * wobble;
    
    vec4 mvPosition = modelViewMatrix * vec4(targetPos, 1.0);
    vDist = length(mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const morphFragmentShader = `
  varying vec2 vUv;
  varying float vDist;
  uniform float uTime;

  void main() {
    vec3 cyan = vec3(0.0, 0.95, 1.0);
    vec3 green = vec3(0.0, 1.0, 0.2);
    
    float pulse = sin(uTime * 3.0) * 0.5 + 0.5;
    vec3 color = mix(cyan, green, pulse);
    
    // Glimmer
    float glimmer = step(0.99, sin(vUv.x * 20.0 + uTime) * sin(vUv.y * 20.0 - uTime));
    color += glimmer;

    gl_FragColor = vec4(color, 0.8);
  }
`;

// --- COMPONENTS ---

function MorphingCore({ morphState }: { morphState: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const geometry = useMemo(() => {
    // We'll use a high-poly sphere as the base and map other shapes onto its vertex count
    const sphere = new THREE.SphereGeometry(1.5, 64, 64);
    const box = new THREE.BoxGeometry(2, 2, 2, 42, 42); // Adjust segments to match vertex count roughly
    // Syncing vertex counts is tricky, let's just use 3 distinct geometries and lerp attributes
    // To keep it simple for this prototype, I'll use a single buffer geometry with custom attributes
    
    const count = sphere.attributes.position.count;
    const posBox = new Float32Array(count * 3);
    const posTorus = new Float32Array(count * 3);

    // Improved Shape Projections
    for (let i = 0; i < count; i++) {
        const x = sphere.attributes.position.getX(i);
        const y = sphere.attributes.position.getY(i);
        const z = sphere.attributes.position.getZ(i);
        
        // Box projection (Floppy Disk-ish)
        posBox[i * 3] = clamp(x * 2.0, -1.5, 1.5);
        posBox[i * 3 + 1] = clamp(y * 2.0, -1.5, 1.5);
        posBox[i * 3 + 2] = clamp(z * 2.0, -0.2, 0.2); // Flat box

        // Cylinder projection (Scroll-ish)
        const radius = 1.0;
        const dist = Math.sqrt(x*x + z*z);
        posTorus[i * 3] = (x / dist) * radius;
        posTorus[i * 3 + 1] = y * 2.0; // Stretched height
        posTorus[i * 3 + 2] = (z / dist) * radius;
    }

    function clamp(v: number, min: number, max: number) {
      return Math.min(Math.max(v, min), max);
    }

    sphere.setAttribute('positionBox', new THREE.BufferAttribute(posBox, 3));
    sphere.setAttribute('positionTorus', new THREE.BufferAttribute(posTorus, 3));
    
    return sphere;
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uMorph: { value: 0 }
  }), []);

  useEffect(() => {
    gsap.to(uniforms.uMorph, {
      value: morphState,
      duration: 1.2,
      ease: 'power3.inOut'
    });
  }, [morphState, uniforms]);

  useFrame((state) => {
    const { clock } = state;
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = clock.getElapsedTime();
      meshRef.current.rotation.y += 0.01;
      meshRef.current.rotation.x += 0.005;
    }
  });

  return (
    <mesh ref={meshRef}>
      <primitive object={geometry} />
      <shaderMaterial
        vertexShader={morphVertexShader}
        fragmentShader={morphFragmentShader}
        uniforms={uniforms}
        wireframe={true}
        transparent={true}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function SigilFloor() {
  const meshRef = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
      <planeGeometry args={[15, 15]} />
      <shaderMaterial
        vertexShader={sigilVertexShader}
        fragmentShader={sigilFragmentShader}
        uniforms={uniforms}
        transparent={true}
      />
    </mesh>
  );
}

export default function Background({ morphState = 0 }: { morphState?: number }) {
  return (
    <div className="fixed inset-0 -z-10 bg-[#020403]">
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <MorphingCore morphState={morphState} />
        <SigilFloor />
      </Canvas>
    </div>
  );
}
