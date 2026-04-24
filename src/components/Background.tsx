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
  uniform float uMorph; 
  
  attribute vec3 positionBox;
  attribute vec3 positionTorus;
  
  varying vec2 vUv;
  varying float vDist;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec4 vWorldPosition;

  // Simple noise function
  float hash(float n) { return fract(sin(n) * 1e4); }
  float noise(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    float n = p.x + p.y*57.0 + 113.0*p.z;
    return mix(mix(mix( hash(n+0.0), hash(n+1.0),f.x),
                   mix( hash(n+57.0), hash(n+58.0),f.x),f.y),
               mix(mix( hash(n+113.0), hash(n+114.0),f.x),
                   mix( hash(n+170.0), hash(n+171.0),f.x),f.y),f.z);
  }

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    vec3 targetPos;
    if (uMorph < 1.0) {
      targetPos = mix(position, positionBox, uMorph);
    } else {
      targetPos = mix(positionBox, positionTorus, uMorph - 1.0);
    }

    // Layered noise for more "alien" organic movement
    float n1 = noise(targetPos * 2.0 + uTime * 0.4);
    float n2 = noise(targetPos * 4.0 - uTime * 0.6);
    float combinedNoise = (n1 * 0.7 + n2 * 0.3);
    
    targetPos += normal * combinedNoise * 0.45;
    
    vWorldPosition = modelMatrix * vec4(targetPos, 1.0);
    vec4 mvPosition = viewMatrix * vWorldPosition;
    vViewPosition = -mvPosition.xyz;
    vDist = length(mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const morphFragmentShader = `
  varying vec2 vUv;
  varying float vDist;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec4 vWorldPosition;
  uniform float uTime;

  // Voronoi for organic/bone structures
  vec2 hash2(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
  }

  float voronoi(vec2 x) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    float m = 8.0;
    for(int j=-1; j<=1; j++)
    for(int i=-1; i<=1; i++) {
        vec2 g = vec2(float(i),float(j));
        vec2 o = hash2(n + g);
        vec2 r = g + o - f;
        float d = dot(r,r);
        if(d<m) m = d;
    }
    return sqrt(m);
  }

  void main() {
    vec3 cyan = vec3(0.0, 0.9, 1.0);
    vec3 neonGreen = vec3(0.0, 1.0, 0.4);
    vec3 boneWhite = vec3(0.9, 0.9, 0.8);
    vec3 deepPurple = vec3(0.2, 0.0, 0.4);
    
    vec3 normal = normalize(vNormal);
    vec3 eye = normalize(vViewPosition);

    // Structural noise (bone/circuit blend)
    float v = voronoi(vUv * 15.0 + uTime * 0.1);
    float circuit = step(0.95, sin(vUv.x * 100.0 + uTime * 0.5) * sin(vUv.y * 100.0));
    
    // Fresnel rim
    float fresnel = pow(1.0 - max(dot(normal, eye), 0.0), 3.0);
    
    // Base lighting
    float light = max(dot(normal, normalize(vec3(1.0, 2.0, 1.0))), 0.0);
    float spec = pow(max(dot(normal, normalize(vec3(0.0, 1.0, 0.5))), 0.0), 32.0);
    
    // Blend bone and circuitry
    vec3 color = mix(deepPurple, boneWhite * 0.4, 1.0 - v);
    color = mix(color, cyan, circuit);
    
    // Final composite
    vec3 finalColor = color * (light + 0.3) + spec * neonGreen;
    finalColor += fresnel * neonGreen * 1.2;
    
    // Pulsing organic light
    float pulse = sin(uTime * 3.0 + v * 10.0) * 0.5 + 0.5;
    finalColor += pulse * neonGreen * 0.15 * (1.0 - v);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// --- COMPONENTS ---

function MorphingCore({ morphState }: { morphState: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const geometry = useMemo(() => {
    // Smaller scale to avoid icon overlap
    const sphere = new THREE.SphereGeometry(0.85, 64, 64);
    const box = new THREE.BoxGeometry(1.2, 1.2, 1.2, 42, 42); 
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
      duration: 2.5,
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
    <mesh ref={meshRef} geometry={geometry}>
      <shaderMaterial
        vertexShader={morphVertexShader}
        fragmentShader={morphFragmentShader}
        uniforms={uniforms}
        wireframe={false}
        transparent={true}
        side={THREE.DoubleSide}
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
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, 0]}>
      <planeGeometry args={[10, 10]} />
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
      <Canvas camera={{ position: [0, 0, 7], fov: 45 }}>
        <MorphingCore morphState={morphState} />
        <SigilFloor />
      </Canvas>
    </div>
  );
}
