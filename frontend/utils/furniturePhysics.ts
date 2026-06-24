/**
 * Furniture Physics System
 * Lightweight physics simulation for furniture movement
 */

import * as THREE from 'three';

export interface PhysicsBody {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  mass: number;
  friction: number;
  restitution: number; // Bounciness
  isGrounded: boolean;
}

export interface PhysicsConfig {
  gravity: number;
  friction: number;
  airResistance: number;
  bounceDamping: number;
  maxVelocity: number;
  minVelocity: number; // Below this, object stops
}

const DEFAULT_CONFIG: PhysicsConfig = {
  gravity: -9.8 * 0.1, // Reduced gravity for AR
  friction: 0.85, // Friction coefficient
  airResistance: 0.95, // Air resistance (0-1)
  bounceDamping: 0.7, // Energy loss on bounce
  maxVelocity: 10.0, // Maximum velocity
  minVelocity: 0.01, // Minimum velocity threshold
};

/**
 * Create a new physics body for furniture
 */
export function createPhysicsBody(
  position: THREE.Vector3,
  mass: number = 1.0,
  config?: Partial<PhysicsConfig>
): PhysicsBody {
  return {
    position: position.clone(),
    velocity: new THREE.Vector3(0, 0, 0),
    acceleration: new THREE.Vector3(0, 0, 0),
    mass,
    friction: config?.friction || DEFAULT_CONFIG.friction,
    restitution: 0.3, // Low bounciness for furniture
    isGrounded: true,
  };
}

/**
 * Apply force to physics body
 */
export function applyForce(
  body: PhysicsBody,
  force: THREE.Vector3,
  config: PhysicsConfig = DEFAULT_CONFIG
): void {
  const acceleration = force.clone().multiplyScalar(1 / body.mass);
  body.acceleration.add(acceleration);
  
  // Clamp acceleration
  const magnitude = body.acceleration.length();
  if (magnitude > config.maxVelocity * 2) {
    body.acceleration.normalize().multiplyScalar(config.maxVelocity * 2);
  }
}

/**
 * Apply drag force (air resistance)
 */
export function applyDrag(
  body: PhysicsBody,
  config: PhysicsConfig = DEFAULT_CONFIG
): void {
  const dragForce = body.velocity.clone().multiplyScalar(-config.airResistance);
  body.acceleration.add(dragForce);
}

/**
 * Apply gravity to physics body
 */
export function applyGravity(
  body: PhysicsBody,
  config: PhysicsConfig = DEFAULT_CONFIG
): void {
  if (!body.isGrounded) {
    body.acceleration.y += config.gravity;
  }
}

/**
 * Update physics body position based on forces
 */
export function updatePhysics(
  body: PhysicsBody,
  deltaTime: number,
  config: PhysicsConfig = DEFAULT_CONFIG
): THREE.Vector3 {
  // Apply gravity
  applyGravity(body, config);
  
  // Apply air resistance
  applyDrag(body, config);
  
  // Update velocity
  body.velocity.add(body.acceleration.clone().multiplyScalar(deltaTime));
  
  // Clamp velocity
  const velocityMagnitude = body.velocity.length();
  if (velocityMagnitude > config.maxVelocity) {
    body.velocity.normalize().multiplyScalar(config.maxVelocity);
  }
  
  // Apply friction when grounded
  if (body.isGrounded && velocityMagnitude > config.minVelocity) {
    body.velocity.multiplyScalar(body.friction);
    
    // Stop if velocity is too small
    if (body.velocity.length() < config.minVelocity) {
      body.velocity.set(0, 0, 0);
    }
  }
  
  // Update position
  const positionDelta = body.velocity.clone().multiplyScalar(deltaTime);
  body.position.add(positionDelta);
  
  // Ground collision
  if (body.position.y < 0) {
    body.position.y = 0;
    
    // Bounce if velocity is significant
    if (Math.abs(body.velocity.y) > 0.1) {
      body.velocity.y *= -body.restitution * config.bounceDamping;
    } else {
      body.velocity.y = 0;
      body.isGrounded = true;
    }
  }
  
  // Reset acceleration
  body.acceleration.set(0, 0, 0);
  
  return body.position.clone();
}

/**
 * Apply impulse (instant velocity change) - useful for dragging
 */
export function applyImpulse(
  body: PhysicsBody,
  impulse: THREE.Vector3,
  config: PhysicsConfig = DEFAULT_CONFIG
): void {
  const velocityChange = impulse.clone().multiplyScalar(1 / body.mass);
  body.velocity.add(velocityChange);
  
  // Clamp velocity
  const magnitude = body.velocity.length();
  if (magnitude > config.maxVelocity) {
    body.velocity.normalize().multiplyScalar(config.maxVelocity);
  }
}

/**
 * Set velocity directly (useful for dragging)
 */
export function setVelocity(
  body: PhysicsBody,
  velocity: THREE.Vector3,
  config: PhysicsConfig = DEFAULT_CONFIG
): void {
  body.velocity.copy(velocity);
  
  // Clamp velocity
  const magnitude = body.velocity.length();
  if (magnitude > config.maxVelocity) {
    body.velocity.normalize().multiplyScalar(config.maxVelocity);
  }
}

/**
 * Calculate collision response between two bodies
 */
export function collisionResponse(
  body1: PhysicsBody,
  body2: PhysicsBody,
  normal: THREE.Vector3,
  penetrationDepth: number
): void {
  // Relative velocity
  const relativeVelocity = body2.velocity.clone().sub(body1.velocity);
  const separatingVelocity = relativeVelocity.dot(normal);
  
  // Don't resolve if velocities are separating
  if (separatingVelocity > 0) return;
  
  // Calculate impulse
  const restitution = Math.min(body1.restitution, body2.restitution);
  const newSeparatingVelocity = -separatingVelocity * restitution;
  
  const deltaVelocity = newSeparatingVelocity - separatingVelocity;
  const totalInverseMass = 1 / body1.mass + 1 / body2.mass;
  const impulse = deltaVelocity / totalInverseMass;
  const impulseVector = normal.clone().multiplyScalar(impulse);
  
  // Apply impulse
  body1.velocity.sub(impulseVector.clone().multiplyScalar(1 / body1.mass));
  body2.velocity.add(impulseVector.clone().multiplyScalar(1 / body2.mass));
  
  // Resolve penetration
  const resolution = normal.clone().multiplyScalar(penetrationDepth * 0.5);
  body1.position.sub(resolution);
  body2.position.add(resolution);
}

/**
 * Smooth interpolation for dragging (spring physics)
 */
export function springTo(
  current: THREE.Vector3,
  target: THREE.Vector3,
  velocity: THREE.Vector3,
  springConstant: number = 50,
  damping: number = 0.9
): { position: THREE.Vector3; velocity: THREE.Vector3 } {
  const displacement = target.clone().sub(current);
  const springForce = displacement.multiplyScalar(springConstant);
  
  const dampingForce = velocity.clone().multiplyScalar(-damping);
  const acceleration = springForce.add(dampingForce);
  
  const newVelocity = velocity.clone().add(acceleration);
  const newPosition = current.clone().add(newVelocity);
  
  return {
    position: newPosition,
    velocity: newVelocity,
  };
}


