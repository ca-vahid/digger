'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSound } from 'use-sound';

// Define grid cell types
enum CellType {
  Dirt = 'dirt',
  Tunnel = 'tunnel',
  Emerald = 'emerald',
  Gold = 'gold',
  Digger = 'digger',
  Nobbin = 'nobbin',
  Hobbin = 'hobbin',
  Cherry = 'cherry', // New cell type for bonus item
}

// Define the game grid dimensions (example values)
const GRID_WIDTH = 30;
const GRID_HEIGHT = 20;

// Define the initial game state
interface Position {
  x: number;
  y: number;
}

interface GoldBagState {
  id: string; // Unique ID for React keys
  pos: Position;
  isFalling: boolean;
  fallDistance: number; // Track consecutive fall distance
}

// New interface for gold nuggets that appear when bags break
interface GoldNuggetState {
  id: string;
  pos: Position;
  value: number; // Point value
}

enum EnemyType { Nobbin, Hobbin }
type Direction = 'up' | 'down' | 'left' | 'right' | 'none'

// Fireball state
interface FireballState {
  id: string;
  pos: Position;
  direction: Direction;
}

interface EnemyState {
  id: string;
  pos: Position;
  type: EnemyType;
  direction: Direction; // Current direction of movement
  transformTimer: number; // Timer for Nobbin->Hobbin transformation
}

// New interface for the bonus cherry
interface BonusCherry {
  pos: Position;
  active: boolean;
  spawnTime: number; // Game ticks until next spawn if not active
}

// Add a new interface for particle effects
interface Particle {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  duration: number;
  angle: number;
  speed: number;
}

// Add sound effect constants
const SOUND_EFFECTS = {
  DIG: '/sounds/dig.mp3',
  COLLECT_EMERALD: '/sounds/collect-emerald.mp3',
  COLLECT_GOLD: '/sounds/collect-gold.mp3',
  COLLECT_CHERRY: '/sounds/collect-cherry.mp3',
  BAG_FALL: '/sounds/bag-fall.mp3',
  BAG_BREAK: '/sounds/bag-break.mp3',
  FIRE: '/sounds/fire.mp3',
  ENEMY_KILL: '/sounds/enemy-kill.mp3',
  DIGGER_DEATH: '/sounds/digger-death.mp3',
  LEVEL_COMPLETE: '/sounds/level-complete.mp3',
  GAME_OVER: '/sounds/game-over.mp3',
  POWER_UP: '/sounds/power-up.mp3',
};

// Add a portal interface
interface Portal {
  entryPos: Position;
  exitPos: Position;
  color: string;
}

interface GameState {
  grid: CellType[][];
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
  diggerPos: Position;
  diggerDirection: Direction; // Track digger's facing direction for shooting
  goldBags: GoldBagState[];
  goldNuggets: GoldNuggetState[]; // Track gold nuggets
  emeralds: Position[]; // Let's track emeralds too
  enemies: EnemyState[]; // Add enemies state
  fireballs: FireballState[]; // Track active fireballs
  fireballCooldown: number; // Ticks until next fireball can be shot
  diggerRespawning: boolean; // Flag for respawn state
  emeraldStreak: number; // Track consecutive emeralds collected
  levelCompleting: boolean; // Flag for level completion animation
  levelTransitionTimer: number; // Timer for level transition
  paused: boolean; // Game pause state
  cherry: BonusCherry; // Bonus cherry state
  powerMode: number; // Ticks remaining in power mode
  particles: Particle[]; // Add particles for visual effects
  shakeEffect: boolean; // Add screen shake effect
  powerUps: PowerUp[];
  activeSpeedBoost: boolean;
  timeFreeze: boolean;
  superFireball: boolean;
  portals: Portal[];
}

// Constants
const TICK_RATE_MS = 150; // Game tick rate
const INITIAL_LIVES = 3;
const RESPAWN_DELAY_MS = 1500; // How long the respawn takes
const FIREBALL_COOLDOWN = 3; // Ticks until next fireball can be shot
const ENEMY_POINTS = 250; // Points for killing an enemy
const HOBBIN_TRANSFORM_TIME = 60; // Ticks until Nobbin transforms into Hobbin
const EMERALD_BASE_POINTS = 25; // Base points for emerald
const EMERALD_STREAK_MULTIPLIER = 2; // Each emerald in a streak doubles points
const GOLD_NUGGET_VALUE = 250; // Points for collecting a gold nugget
const LEVEL_TRANSITION_TIME = 30; // Ticks for level transition (about 4.5 seconds)
const LEVEL_COMPLETE_BONUS = 1000; // Points for completing a level
const POWER_MODE_DURATION = 60; // Ticks in power mode (about 9 seconds)
const POWER_MODE_ENEMY_POINTS = 400; // Points for eating enemies in power mode
const CHERRY_SPAWN_MIN = 80; // Min ticks until cherry spawn (12 seconds)
const CHERRY_SPAWN_MAX = 200; // Max ticks until cherry spawn (30 seconds)
const CHERRY_POINTS = 500; // Points for collecting a cherry
const PARTICLES_COUNT = 15; // Number of particles to create for effects
const ANIMATION_DURATION = 0.5; // Animation duration in seconds

// Add a SoundManager component
const SoundManager = ({ gameState, prevGameState }: { gameState: GameState, prevGameState: GameState | null }) => {
  // Use the useSound hook for each sound effect
  const [playDig] = useSound('/sounds/dig.mp3', { volume: 0.5 });
  const [playCollectEmerald] = useSound('/sounds/collect-emerald.mp3', { volume: 0.6 });
  const [playCollectGold] = useSound('/sounds/collect-gold.mp3', { volume: 0.6 });
  const [playCollectCherry] = useSound('/sounds/collect-cherry.mp3', { volume: 0.7 });
  const [playBagFall] = useSound('/sounds/bag-fall.mp3', { volume: 0.5 });
  const [playBagBreak] = useSound('/sounds/bag-break.mp3', { volume: 0.6 });
  const [playFire] = useSound('/sounds/fire.mp3', { volume: 0.5 });
  const [playEnemyKill] = useSound('/sounds/enemy-kill.mp3', { volume: 0.6 });
  const [playDiggerDeath] = useSound('/sounds/digger-death.mp3', { volume: 0.7 });
  const [playLevelComplete] = useSound('/sounds/level-complete.mp3', { volume: 0.7 });
  const [playGameOver] = useSound('/sounds/game-over.mp3', { volume: 0.7 });
  const [playPowerUp] = useSound('/sounds/power-up.mp3', { volume: 0.7 });
  
  // Handle sound effect errors
  const [soundReady, setSoundReady] = useState(false);
  
  useEffect(() => {
    // Set sound as ready to prevent errors before sound files are loaded
    setSoundReady(true);
    
    // Create Audio objects to preload sounds
    const preloadSounds = () => {
      const soundFiles = Object.values(SOUND_EFFECTS);
      soundFiles.forEach(src => {
        try {
          const audio = new Audio();
          audio.src = src;
        } catch (err) {
          console.log('Error preloading sound:', err);
        }
      });
    };
    
    preloadSounds();
  }, []);
  
  useEffect(() => {
    if (!prevGameState || !soundReady) return;
    
    // Detect emerald collection
    if (gameState.score > prevGameState.score && !gameState.gameOver) {
      // Different sounds for different items
      const prevEmeraldCount = prevGameState.emeralds.length;
      const currentEmeraldCount = gameState.emeralds.length;
      
      if (currentEmeraldCount < prevEmeraldCount) {
        try { playCollectEmerald(); } catch (e) { console.log('Sound error:', e); }
      }
    }
    
    // Detect bag falling
    const currentBags = gameState.goldBags;
    const prevBags = prevGameState.goldBags;
    for (let i = 0; i < currentBags.length; i++) {
      if (currentBags[i].isFalling && !prevBags[i].isFalling) {
        try { playBagFall(); } catch (e) { console.log('Sound error:', e); }
      }
      if (currentBags[i].fallDistance > 1 && prevBags[i].fallDistance <= 1) {
        try { playBagBreak(); } catch (e) { console.log('Sound error:', e); }
      }
    }
    
    // Detect gold nugget collection
    if (gameState.goldNuggets.length < prevGameState.goldNuggets.length) {
      try { playCollectGold(); } catch (e) { console.log('Sound error:', e); }
    }
    
    // Detect digger death
    if (gameState.diggerRespawning && !prevGameState.diggerRespawning) {
      try { playDiggerDeath(); } catch (e) { console.log('Sound error:', e); }
    }
    
    // Detect level complete
    if (gameState.levelCompleting && !prevGameState.levelCompleting) {
      try { playLevelComplete(); } catch (e) { console.log('Sound error:', e); }
    }
    
    // Detect game over
    if (gameState.gameOver && !prevGameState.gameOver) {
      try { playGameOver(); } catch (e) { console.log('Sound error:', e); }
    }
    
    // Detect power mode activation
    if (gameState.powerMode > 0 && prevGameState.powerMode === 0) {
      try { playPowerUp(); } catch (e) { console.log('Sound error:', e); }
    }
    
    // Detect firing
    if (gameState.fireballs.length > prevGameState.fireballs.length) {
      try { playFire(); } catch (e) { console.log('Sound error:', e); }
    }
    
    // Detect enemy kill
    if (gameState.enemies.length < prevGameState.enemies.length) {
      try { playEnemyKill(); } catch (e) { console.log('Sound error:', e); }
    }
    
    // Detect digging (moving into dirt)
    const prevPos = prevGameState.diggerPos;
    const currentPos = gameState.diggerPos;
    if (prevPos.x !== currentPos.x || prevPos.y !== currentPos.y) {
      try { playDig(); } catch (e) { console.log('Sound error:', e); }
    }
    
  }, [gameState, prevGameState, soundReady, playDig, playCollectEmerald, playCollectGold, 
      playCollectCherry, playBagFall, playBagBreak, playFire, playEnemyKill, 
      playDiggerDeath, playLevelComplete, playGameOver, playPowerUp]);
  
  return null;
};

// Add new power-up types
enum PowerUpType {
  SpeedBoost = 'SpeedBoost',
  ExtraLife = 'ExtraLife',
  TimeFreeze = 'TimeFreeze',
  SuperFireball = 'SuperFireball',
}

// Define a power-up interface
interface PowerUp {
  type: PowerUpType;
  pos: Position;
  active: boolean;
  duration: number; // how long the effect lasts
  collectTime: number; // when it was collected
}

// Add ClientOnly wrapper component to prevent hydration issues
const ClientOnly = ({ children }: { children: React.ReactNode }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return isMounted ? <>{children}</> : <div className="min-h-screen bg-black"></div>;
};

// Define the Game component
const Game: React.FC = () => {
  // Add isClient state to handle hydration issues
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  const [gameState, setGameState] = useState<GameState>(() => {
    const initialLevel = generateInitialLevel();
    return {
      ...initialLevel,
      score: 0,
      lives: INITIAL_LIVES,
      level: 1,
      gameOver: false,
      diggerRespawning: false,
      fireballCooldown: 0, // Start with no cooldown
      emeraldStreak: 0, // Start with no streak
      levelCompleting: false,
      levelTransitionTimer: 0,
      paused: false,
      powerMode: 0, // Start with no power mode
      particles: [],
      shakeEffect: false,
      powerUps: [],
      activeSpeedBoost: false,
      timeFreeze: false,
      superFireball: false,
      portals: [],
    };
  });

  // Add a ref to track previous game state
  const prevGameStateRef = useRef<GameState | null>(null);

  // --- Handle Digger Death & Respawn (moved inside component) ---
  const handleDiggerDeath = (prevState: GameState): Partial<GameState> => {
    console.log("Handling Digger Death. Lives left:", prevState.lives - 1);
    const newLives = prevState.lives - 1;
    if (newLives <= 0) {
      return { lives: 0, gameOver: true, diggerRespawning: false };
    }

    const startPos = getStartPosition(); // Uses helper defined outside
    const newGrid = prevState.grid.map(row => [...row]);
    if (newGrid[startPos.y]?.[startPos.x] !== undefined) {
      newGrid[startPos.y][startPos.x] = CellType.Tunnel;
    }
    if (!(prevState.diggerPos.x === startPos.x && prevState.diggerPos.y === startPos.y)) {
      if (newGrid[prevState.diggerPos.y]?.[prevState.diggerPos.x] === CellType.Digger) {
        newGrid[prevState.diggerPos.y][prevState.diggerPos.x] = CellType.Tunnel;
      }
    }
    return {
      lives: newLives,
      diggerPos: startPos,
      diggerDirection: 'right', // Reset direction on respawn
      grid: newGrid,
      diggerRespawning: true,
      fireballs: [], // Clear any fireballs when digger dies
      fireballCooldown: 0, // Reset cooldown
      emeraldStreak: 0, // Reset emerald streak on death
      powerMode: 0, // Reset power mode on death
    };
  };

  // Effect to handle the end of the respawn delay
  useEffect(() => {
    let respawnTimer: NodeJS.Timeout | null = null;
    if (gameState.diggerRespawning) {
      console.log("Starting respawn timer...");
      respawnTimer = setTimeout(() => {
        console.log("Respawn timer finished.");
        setGameState((prev: GameState) => { // Add type annotation for prev
          const finalGrid = prev.grid.map((row, y) =>
            row.map((cell, x) =>
              (x === prev.diggerPos.x && y === prev.diggerPos.y && cell === CellType.Tunnel) ? CellType.Digger : cell
            )
          );
          return {
            ...prev,
            diggerRespawning: false,
            grid: finalGrid,
          };
        });
      }, RESPAWN_DELAY_MS);
    }
    return () => {
      if (respawnTimer) {
        console.log("Clearing respawn timer.");
        clearTimeout(respawnTimer);
      }
    };
  }, [gameState.diggerRespawning]);

  // Effect to handle the level completion animation and transition
  useEffect(() => {
    let levelTimer: NodeJS.Timeout | null = null;
    
    if (gameState.levelCompleting && gameState.levelTransitionTimer > 0) {
      console.log(`Level completion animation: ${gameState.levelTransitionTimer} ticks remaining`);
      
      levelTimer = setTimeout(() => {
        setGameState(prevState => {
          const newTimer = prevState.levelTransitionTimer - 1;
          
          if (newTimer <= 0) {
            // Create the next level when the timer expires
            const nextLevel = prevState.level + 1;
            const initialLevel = generateInitialLevel(nextLevel);
            
            return {
              ...prevState,
              ...initialLevel,
              level: nextLevel,
              levelCompleting: false,
              levelTransitionTimer: 0,
              emeraldStreak: 0,
              fireballCooldown: 0,
              powerMode: 0
            };
          }
          
          return {
            ...prevState,
            levelTransitionTimer: newTimer
          };
        });
      }, TICK_RATE_MS);
    }
    
    return () => {
      if (levelTimer) {
        clearTimeout(levelTimer);
      }
    };
  }, [gameState.levelCompleting, gameState.levelTransitionTimer]);

  // --- Game Loop (for gravity, enemy movement, etc.) ---
  useEffect(() => {
    if (gameState.gameOver || gameState.diggerRespawning || gameState.levelCompleting || gameState.paused) return; // Pause loop during respawn, level transition, or when paused

    const gameInterval = setInterval(() => {
      setGameState((prevState: GameState) => {
        if (prevState.gameOver || prevState.diggerRespawning || prevState.levelCompleting || prevState.paused) return prevState;

        let stateChanges: Partial<GameState> = {};
        let gridChanged = false;
        const newGrid = prevState.grid.map(row => [...row]);
        let newScore = prevState.score;
        let diggerKilled = false;
        let newFireballCooldown = Math.max(0, prevState.fireballCooldown - 1); // Decrease cooldown
        let newPowerMode = Math.max(0, prevState.powerMode - 1); // Decrease power mode timer

        // --- Process Bonus Cherry ---
        let cherryState = { ...prevState.cherry };
        
        // Handle cherry timer if not active
        if (!cherryState.active) {
          cherryState.spawnTime--;
          
          // Spawn a cherry if timer reached zero
          if (cherryState.spawnTime <= 0) {
            // Find a random valid tunnel position for the cherry
            const validPositions = [];
            for (let y = 0; y < GRID_HEIGHT; y++) {
              for (let x = 0; x < GRID_WIDTH; x++) {
                if (newGrid[y][x] === CellType.Tunnel && 
                    !(prevState.diggerPos.x === x && prevState.diggerPos.y === y) &&
                    !prevState.enemies.some(e => e.pos.x === x && e.pos.y === y)) {
                  validPositions.push({ x, y });
                }
              }
            }
            
            // If we found valid positions, place a cherry
            if (validPositions.length > 0) {
              const randomPos = validPositions[Math.floor(Math.random() * validPositions.length)];
              cherryState = {
                ...cherryState,
                pos: randomPos,
                active: true
              };
              newGrid[randomPos.y][randomPos.x] = CellType.Cherry;
              gridChanged = true;
              console.log("Cherry spawned at", randomPos);
            } else {
              // If no valid positions, reset timer
              cherryState.spawnTime = CHERRY_SPAWN_MIN + Math.floor(Math.random() * (CHERRY_SPAWN_MAX - CHERRY_SPAWN_MIN));
            }
          }
        }
        
        // Check for cherry collection - FIXED to be more reliable
        if (cherryState.active) {
          // Compare positions directly - this is the most reliable way
          const diggerX = prevState.diggerPos.x;
          const diggerY = prevState.diggerPos.y;
          const cherryX = cherryState.pos.x;
          const cherryY = cherryState.pos.y;
          
          if (diggerX === cherryX && diggerY === cherryY) {
            console.log(`CHERRY COLLECTED at ${cherryX},${cherryY} by digger at ${diggerX},${diggerY}`);
            // Collect the cherry
            newScore += CHERRY_POINTS;
            // Clear the cherry from the grid
            newGrid[cherryY][cherryX] = CellType.Tunnel;
            cherryState = {
              pos: { x: -1, y: -1 }, // Off-screen position
              active: false,
              spawnTime: CHERRY_SPAWN_MIN + Math.floor(Math.random() * (CHERRY_SPAWN_MAX - CHERRY_SPAWN_MIN))
            };
            newPowerMode = POWER_MODE_DURATION;
            gridChanged = true;
          }
        }

        // --- Check for level completion ---
        if (prevState.emeralds.length === 0 && !prevState.levelCompleting) {
          console.log("All emeralds collected! Level complete!");
          newScore += LEVEL_COMPLETE_BONUS; // Award bonus for level completion
          return {
            ...prevState,
            levelCompleting: true,
            levelTransitionTimer: LEVEL_TRANSITION_TIME,
            score: newScore
          };
        }

        // --- Handle Gold Bag Logic --- 
        const sortedBagIndices = prevState.goldBags
          .map((_, index) => index)
          .sort((a, b) => prevState.goldBags[b].pos.y - prevState.goldBags[a].pos.y);

        let currentGoldBags = [...prevState.goldBags];
        const bagsToRemove = new Set<string>();
        let newGoldNuggets = [...prevState.goldNuggets]; // Track gold nuggets

        for (const index of sortedBagIndices) {
          let bag = currentGoldBags[index];
          if (bagsToRemove.has(bag.id)) continue;

          const { x, y } = bag.pos;
          const nextY = y + 1;

          if (nextY < GRID_HEIGHT) {
            const cellBelow = newGrid[nextY]?.[x];
            const canFall = cellBelow === CellType.Tunnel;

            if (canFall && !prevState.diggerRespawning && prevState.diggerPos.x === x && prevState.diggerPos.y === nextY) {
              console.log(`Digger crushed by bag ${bag.id} falling into ${x}, ${nextY}`);
              diggerKilled = true;
            }

            if (canFall) {
              if (newGrid[y]?.[x] === CellType.Gold) newGrid[y][x] = CellType.Tunnel;
              newGrid[nextY][x] = CellType.Gold;
              gridChanged = true;

              const updatedBag = {
                ...bag,
                pos: { x, y: nextY },
                isFalling: true,
                fallDistance: bag.fallDistance + 1,
              };
              currentGoldBags[index] = updatedBag;
              bag = updatedBag;

            } else {
              if (bag.isFalling) {
                if (bag.fallDistance > 1) {
                  console.log(`Bag ${bag.id} broke after falling ${bag.fallDistance} squares, landing at ${x}, ${y}`);
                  newScore += 25; // Small score for breaking the bag itself
                  bagsToRemove.add(bag.id);
                  if (newGrid[y]?.[x] === CellType.Gold) {
                    newGrid[y][x] = CellType.Tunnel;
                  }
                  gridChanged = true;

                  // Spawn gold nuggets in adjacent cells when the bag breaks
                  const possibleOffsets = [
                    { dx: 0, dy: 0 },   // Center (where bag broke)
                    { dx: -1, dy: 0 },  // Left
                    { dx: 1, dy: 0 },   // Right
                    { dx: 0, dy: -1 },  // Up
                  ];
                  
                  // Try to spawn 1-3 nuggets
                  const nuggetCount = 1 + Math.floor(Math.random() * 3);
                  let placedNuggets = 0;
                  
                  // Shuffle the possible offsets for random placement
                  const shuffledOffsets = [...possibleOffsets].sort(() => Math.random() - 0.5);
                  
                  for (const offset of shuffledOffsets) {
                    if (placedNuggets >= nuggetCount) break;
                    
                    const nuggetX = x + offset.dx;
                    const nuggetY = y + offset.dy;
                    
                    // Check if position is valid for a nugget (must be a tunnel)
                    if (nuggetX >= 0 && nuggetX < GRID_WIDTH && 
                        nuggetY >= 0 && nuggetY < GRID_HEIGHT && 
                        newGrid[nuggetY][nuggetX] === CellType.Tunnel) {
                      
                      // Create a new gold nugget
                      const newNugget: GoldNuggetState = {
                        id: `nugget-${Date.now()}-${placedNuggets}`,
                        pos: { x: nuggetX, y: nuggetY },
                        value: GOLD_NUGGET_VALUE
                      };
                      
                      newGoldNuggets.push(newNugget);
                      placedNuggets++;
                    }
                  }

                  if (!prevState.diggerRespawning && prevState.diggerPos.x === x && prevState.diggerPos.y === y) {
                    console.log(`Digger crushed by breaking bag ${bag.id} at ${x}, ${y}`);
                    diggerKilled = true;
                  }
                } else {
                  const landedBag = { ...bag, isFalling: false, fallDistance: 0 };
                  currentGoldBags[index] = landedBag;
                  if (newGrid[y]?.[x] !== CellType.Gold) {
                    newGrid[y][x] = CellType.Gold;
                    gridChanged = true;
                  }
                }
              } else {
                if (bag.fallDistance > 0) {
                  currentGoldBags[index] = { ...bag, fallDistance: 0 };
                }
              }
            }
          } else {
            if (bag.isFalling) {
              if (bag.fallDistance > 1) {
                console.log(`Bag ${bag.id} broke falling off bottom at ${x}, ${y}`);
                newScore += 25;
                bagsToRemove.add(bag.id);
                if (newGrid[y]?.[x] === CellType.Gold) newGrid[y][x] = CellType.Tunnel;
                gridChanged = true;
                if (!prevState.diggerRespawning && prevState.diggerPos.x === x && prevState.diggerPos.y === y) {
                  diggerKilled = true;
                }
              } else {
                currentGoldBags[index] = { ...bag, isFalling: false, fallDistance: 0 };
              }
            } else if (bag.fallDistance > 0) {
              currentGoldBags[index] = { ...bag, fallDistance: 0 };
            }
          }
        }

        const finalGoldBags = currentGoldBags.filter(bag => !bagsToRemove.has(bag.id));
        
        // --- Check for Digger collecting gold nuggets ---
        const collectedNuggets = new Set<string>();
        const diggerX = prevState.diggerPos.x;
        const diggerY = prevState.diggerPos.y;
        
        newGoldNuggets.forEach(nugget => {
          if (nugget.pos.x === diggerX && nugget.pos.y === diggerY) {
            // Digger collected a gold nugget!
            collectedNuggets.add(nugget.id);
            newScore += nugget.value;
            console.log(`Collected gold nugget worth ${nugget.value} points!`);
          }
        });
        
        // Remove collected nuggets
        if (collectedNuggets.size > 0) {
          newGoldNuggets = newGoldNuggets.filter(nugget => !collectedNuggets.has(nugget.id));
        }
        // --- End Gold Bag Logic ---

        // --- Process Fireballs ---
        const enemiesHitByFireball = new Set<string>(); // Track which enemies to remove
        const fireballsToRemove = new Set<string>(); // Track which fireballs to remove

        // Update positions of existing fireballs and check for collisions
        const updatedFireballs = prevState.fireballs.map(fireball => {
          const { pos, direction } = fireball;
          let newX = pos.x;
          let newY = pos.y;
          
          // Move the fireball in its direction
          switch (direction) {
            case 'up': newY = pos.y - 1; break;
            case 'down': newY = pos.y + 1; break;
            case 'left': newX = pos.x - 1; break;
            case 'right': newX = pos.x + 1; break;
          }
          
          // Check if fireball hits a boundary or dirt
          if (newX < 0 || newX >= GRID_WIDTH || newY < 0 || newY >= GRID_HEIGHT ||
              newGrid[newY][newX] === CellType.Dirt || newGrid[newY][newX] === CellType.Gold) {
            fireballsToRemove.add(fireball.id);
            return fireball; // Will be filtered out later
          }
          
          // Check if fireball hits an enemy - THIS SECTION IS FIXED TO ENSURE IT WORKS
          const hitEnemy = prevState.enemies.find(enemy => enemy.pos.x === newX && enemy.pos.y === newY);
          if (hitEnemy) {
            console.log(`Fireball hit enemy ${hitEnemy.id} (${hitEnemy.type === EnemyType.Nobbin ? 'Nobbin' : 'Hobbin'})!`);
            enemiesHitByFireball.add(hitEnemy.id);
            fireballsToRemove.add(fireball.id);
            newScore += ENEMY_POINTS; // Award points for killing enemy
            return fireball; // Will be filtered out later
          }
          
          // Continue moving if no collision
          return { ...fireball, pos: { x: newX, y: newY } };
        });
        
        // Keep only fireballs that haven't hit anything
        const finalFireballs = updatedFireballs.filter(fireball => !fireballsToRemove.has(fireball.id));
        
        // --- Process Enemies ---
        let finalEnemies = prevState.enemies
          .filter(enemy => !enemiesHitByFireball.has(enemy.id)) // Remove enemies hit by fireballs
          .map(enemy => {
            // Only process enemy movement if digger hasn't been killed
            if (diggerKilled) return enemy; 
            
            // Update transformation timer for Nobbins
            let updatedEnemy = { ...enemy };
            if (updatedEnemy.type === EnemyType.Nobbin) {
              // Decrement timer and check for transformation
              updatedEnemy.transformTimer -= 1;
              if (updatedEnemy.transformTimer <= 0) {
                console.log(`Nobbin ${enemy.id} transformed into a Hobbin!`);
                updatedEnemy.type = EnemyType.Hobbin;
              }
            }
            
            // Enhanced movement logic based on enemy type
            if (updatedEnemy.type === EnemyType.Nobbin) {
              // Nobbin movement (wander in tunnels)
              const { pos, direction } = updatedEnemy;
              const possibleDirections: Direction[] = ['up', 'down', 'left', 'right'];
              let newDirection = direction;
              
              // For now, just have Nobbins wander randomly in tunnels
              // This can be replaced with more sophisticated logic later
              const randomDir = possibleDirections[Math.floor(Math.random() * 4)];
              
              // Try to move in current direction if possible
              let newX = pos.x;
              let newY = pos.y;
              
              switch (direction) {
                case 'up': newY = Math.max(0, pos.y - 1); break;
                case 'down': newY = Math.min(GRID_HEIGHT - 1, pos.y + 1); break;
                case 'left': newX = Math.max(0, pos.x - 1); break;
                case 'right': newX = Math.min(GRID_WIDTH - 1, pos.x + 1); break;
              }
              
              // Only move if the target cell is a tunnel
              if (newGrid[newY][newX] === CellType.Tunnel || newGrid[newY][newX] === CellType.Cherry) {
                // Check for collision with digger
                if (!prevState.diggerRespawning && 
                    prevState.diggerPos.x === newX && 
                    prevState.diggerPos.y === newY) {
                  // If in power mode, don't kill digger
                  if (newPowerMode > 0) {
                    return updatedEnemy; // Don't move if Digger is powered up
                  }
                  diggerKilled = true;
                  return updatedEnemy; // Don't move if colliding with digger
                }
                
                return { ...updatedEnemy, pos: { x: newX, y: newY } };
              } else {
                // Change direction if blocked
                return { ...updatedEnemy, direction: randomDir };
              }
            } else if (updatedEnemy.type === EnemyType.Hobbin) {
              // Hobbin movement (smarter tunnel navigation, NO digging)
              const { pos, direction } = updatedEnemy;
              
              // Calculate direction to move towards Digger (more aggressive)
              // Simple algorithm to move towards Digger when possible
              let newDirection = direction;
              
              // 75% chance to try to move towards Digger, 25% chance to continue in current direction
              if (Math.random() < 0.75) {
                // Simple chase logic - choose the direction that gets us closer to Digger
                const dx = prevState.diggerPos.x - pos.x;
                const dy = prevState.diggerPos.y - pos.y;
                
                if (Math.abs(dx) > Math.abs(dy)) {
                  // Move horizontally
                  newDirection = dx > 0 ? 'right' : 'left';
                } else {
                  // Move vertically
                  newDirection = dy > 0 ? 'down' : 'up';
                }
              }
              
              // Try to move in the chosen direction
              let newX = pos.x;
              let newY = pos.y;
              
              switch (newDirection) {
                case 'up': newY = Math.max(0, pos.y - 1); break;
                case 'down': newY = Math.min(GRID_HEIGHT - 1, pos.y + 1); break;
                case 'left': newX = Math.max(0, pos.x - 1); break;
                case 'right': newX = Math.min(GRID_WIDTH - 1, pos.x + 1); break;
              }
              
              // FIX: Hobbins can ONLY move through TUNNELS or CHERRY (not through dirt)
              if (newX >= 0 && newX < GRID_WIDTH && newY >= 0 && newY < GRID_HEIGHT && 
                  (newGrid[newY][newX] === CellType.Tunnel || newGrid[newY][newX] === CellType.Cherry)) {
                
                // Check for collision with digger
                if (!prevState.diggerRespawning && 
                    prevState.diggerPos.x === newX && 
                    prevState.diggerPos.y === newY) {
                  if (newPowerMode > 0) {
                    // Don't kill digger in power mode
                    console.log(`Hobbin ${updatedEnemy.id} tried to attack Digger but was repelled by power mode`);
                    return updatedEnemy; // Don't move if encountering powered digger
                  } else {
                    // Kill digger in normal mode
                    diggerKilled = true;
                    console.log(`Hobbin ${updatedEnemy.id} killed Digger!`);
                    return updatedEnemy; // Don't move if colliding with digger
                  }
                }
                
                return { ...updatedEnemy, pos: { x: newX, y: newY }, direction: newDirection };
              } else {
                // If blocked, try to pick a new random direction
                const possibleDirections: Direction[] = ['up', 'down', 'left', 'right'];
                const randomDir = possibleDirections[Math.floor(Math.random() * 4)];
                return { ...updatedEnemy, direction: randomDir };
              }
            }
            
            // Return unmodified enemy if not handled above
            return updatedEnemy;
          });
        
        // Check for enemy collisions with Digger while in power mode or normal mode
        const eatenEnemies = new Set<string>();
        finalEnemies.forEach(enemy => {
          if (enemy.pos.x === prevState.diggerPos.x && enemy.pos.y === prevState.diggerPos.y) {
            if (newPowerMode > 0) {
              // In power mode, eat the enemy
              console.log(`Digger ate enemy ${enemy.id} in power mode!`);
              eatenEnemies.add(enemy.id);
              newScore += POWER_MODE_ENEMY_POINTS;
            } else {
              // In normal mode, digger dies
              diggerKilled = true;
              console.log(`Enemy ${enemy.id} killed Digger!`);
            }
          }
        });
        
        // Remove eaten enemies
        if (eatenEnemies.size > 0) {
          finalEnemies = finalEnemies.filter(enemy => !eatenEnemies.has(enemy.id));
        }
        
        // --- Apply State Changes ---
        if (diggerKilled) {
          const deathStateChanges = handleDiggerDeath(prevState);
          stateChanges = {
            ...deathStateChanges,
            score: newScore,
            goldBags: finalGoldBags,
            goldNuggets: newGoldNuggets,
            enemies: finalEnemies.filter(enemy => !enemiesHitByFireball.has(enemy.id)), // Remove killed enemies
            fireballs: [], // Clear fireballs on death
            fireballCooldown: 0,
            emeraldStreak: 0, // Reset emerald streak on death
            powerMode: 0, // Reset power mode on death
            cherry: cherryState,
            ...(deathStateChanges.gameOver && { grid: newGrid })
          };
        } else {
          // Check for significant state changes
          const bagsChanged = JSON.stringify(finalGoldBags) !== JSON.stringify(prevState.goldBags);
          const nuggetsChanged = JSON.stringify(newGoldNuggets) !== JSON.stringify(prevState.goldNuggets);
          const enemiesChanged = finalEnemies.length !== prevState.enemies.length || 
                               JSON.stringify(finalEnemies) !== JSON.stringify(prevState.enemies);
          const fireballsChanged = finalFireballs.length !== prevState.fireballs.length || 
                                 JSON.stringify(finalFireballs) !== JSON.stringify(prevState.fireballs);
          const cherryChanged = JSON.stringify(cherryState) !== JSON.stringify(prevState.cherry);
          const powerModeChanged = newPowerMode !== prevState.powerMode;
          
          if (gridChanged || bagsChanged || nuggetsChanged || enemiesChanged || fireballsChanged || 
              newScore !== prevState.score || newFireballCooldown !== prevState.fireballCooldown || 
              cherryChanged || powerModeChanged) {
            stateChanges = {
              grid: newGrid,
              goldBags: finalGoldBags,
              goldNuggets: newGoldNuggets,
              enemies: finalEnemies,
              fireballs: finalFireballs,
              score: newScore,
              fireballCooldown: newFireballCooldown,
              cherry: cherryState,
              powerMode: newPowerMode
            };
          } else {
            return prevState; // No relevant changes
          }
        }

        return { ...prevState, ...stateChanges };
      });

      // Store the current state for the sound manager to compare
      prevGameStateRef.current = { ...gameState };
    }, TICK_RATE_MS);

    return () => clearInterval(gameInterval);
  }, [gameState.gameOver, gameState.diggerRespawning, gameState.levelCompleting, gameState.paused]); // Added paused to dependencies

  // --- Input Handling (useEffect) ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Space key for pause (active any time except game over)
      if (event.key === ' ' && !gameState.gameOver) {
        setGameState(prevState => ({
          ...prevState,
          paused: !prevState.paused
        }));
        return;
      }

      if (gameState.gameOver || gameState.diggerRespawning || gameState.levelCompleting || gameState.paused) return;

      setGameState(prevState => { 
        if (prevState.gameOver || prevState.diggerRespawning || prevState.levelCompleting || prevState.paused) return prevState;

        // Handle F key for firing (was previously F1)
        if (event.key === 'f' || event.key === 'F') {
          // Check if fireball cooldown has expired
          if (prevState.fireballCooldown <= 0) {
            // Calculate position in front of digger based on direction
            let fireballX = prevState.diggerPos.x;
            let fireballY = prevState.diggerPos.y;
            
            switch (prevState.diggerDirection) {
              case 'up': fireballY -= 1; break;
              case 'down': fireballY += 1; break;
              case 'left': fireballX -= 1; break;
              case 'right': fireballX += 1; break;
            }
            
            // Only spawn fireball if the target position is a tunnel (not dirt/wall)
            if (fireballX >= 0 && fireballX < GRID_WIDTH && 
                fireballY >= 0 && fireballY < GRID_HEIGHT && 
                (prevState.grid[fireballY][fireballX] === CellType.Tunnel || 
                 prevState.grid[fireballY][fireballX] === CellType.Cherry)) {
              
              // Create a new fireball
              const newFireball: FireballState = {
                id: `fireball-${Date.now()}`, // Generate unique ID
                pos: { x: fireballX, y: fireballY },
                direction: prevState.diggerDirection
              };
              
              return {
                ...prevState,
                fireballs: [...prevState.fireballs, newFireball],
                fireballCooldown: FIREBALL_COOLDOWN
              };
            }
            
            // If can't spawn fireball, still set cooldown
            return { ...prevState, fireballCooldown: FIREBALL_COOLDOWN };
          }
          
          // If cooldown hasn't expired, do nothing
          return prevState;
        }

        // Handle movement keys
        const { x, y } = prevState.diggerPos;
        let newX = x;
        let newY = y;
        let newDirection = prevState.diggerDirection;

        switch (event.key) {
          case 'ArrowUp': 
            newY = y - 1; 
            newDirection = 'up'; 
            break;
          case 'ArrowDown': 
            newY = y + 1; 
            newDirection = 'down'; 
            break;
          case 'ArrowLeft': 
            newX = x - 1; 
            newDirection = 'left'; 
            break;
          case 'ArrowRight': 
            newX = x + 1; 
            newDirection = 'right'; 
            break;
          default: 
            return prevState;
        }

        if (newX < 0 || newX >= GRID_WIDTH || newY < 0 || newY >= GRID_HEIGHT) {
          return { ...prevState, diggerDirection: newDirection }; // Just update direction if can't move
        }

        const currentGrid = prevState.grid;
        const targetCell = currentGrid[newY]?.[newX];
        let newGrid = currentGrid.map(row => [...row]);
        let newScore = prevState.score;
        let newEmeralds = [...prevState.emeralds];
        let newEmeraldStreak = prevState.emeraldStreak;
        let stateUpdate: Partial<GameState> = { diggerDirection: newDirection }; // Always update direction

        // Check for cherry at target position - handle before other cell types
        let foundCherry = false;
        let newCherry = { ...prevState.cherry };
        let newPowerMode = prevState.powerMode;
        
        if (prevState.cherry.active && prevState.cherry.pos.x === newX && prevState.cherry.pos.y === newY) {
          console.log(`Cherry found at target position (${newX},${newY}), collecting!`);
          foundCherry = true;
          newCherry = {
            pos: { x: -1, y: -1 },
            active: false,
            spawnTime: CHERRY_SPAWN_MIN + Math.random() * (CHERRY_SPAWN_MAX - CHERRY_SPAWN_MIN)
          };
          newPowerMode = POWER_MODE_DURATION;
          newScore += CHERRY_POINTS;
          // The cell will be set to tunnel below
        }

        if (targetCell === CellType.Dirt || targetCell === CellType.Tunnel || targetCell === CellType.Cherry) {
          if (newGrid[y]?.[x] === CellType.Digger) newGrid[y][x] = CellType.Tunnel;
          newGrid[newY][newX] = CellType.Digger;
          newEmeraldStreak = 0; // Reset emerald streak when not collecting emeralds
          
          stateUpdate = { 
            ...stateUpdate, 
            grid: newGrid, 
            diggerPos: { x: newX, y: newY }, 
            emeraldStreak: newEmeraldStreak 
          };
          
          // Add cherry collection updates if needed
          if (foundCherry) {
            stateUpdate = {
              ...stateUpdate,
              cherry: newCherry,
              powerMode: newPowerMode,
              score: newScore
            };
          }
        } else if (targetCell === CellType.Emerald) {
          if (newGrid[y]?.[x] === CellType.Digger) newGrid[y][x] = CellType.Tunnel;
          newGrid[newY][newX] = CellType.Digger;
          
          // Increase emerald streak and calculate points
          newEmeraldStreak = newEmeraldStreak + 1;
          const streakMultiplier = Math.pow(EMERALD_STREAK_MULTIPLIER, newEmeraldStreak - 1);
          const pointsEarned = EMERALD_BASE_POINTS * streakMultiplier;
          
          console.log(`Collected emerald! Streak: ${newEmeraldStreak}, Points: ${pointsEarned}`);
          newScore += pointsEarned;
          
          newEmeralds = newEmeralds.filter(em => !(em.x === newX && em.y === newY));
          stateUpdate = { 
            ...stateUpdate, 
            grid: newGrid, 
            diggerPos: { x: newX, y: newY }, 
            score: newScore, 
            emeralds: newEmeralds,
            emeraldStreak: newEmeraldStreak
          };
          
          // Add particle effect
          const emeraldParticles = createParticles(newX, newY, 'emerald');
          stateUpdate = { 
            ...stateUpdate,
            particles: [...prevState.particles, ...emeraldParticles]
          };
        } else if (targetCell === CellType.Gold) {
          let pushToX = newX;
          let pushToY = newY;
          let pushDirection = ''; // Added explicitly for clarity

          if (newDirection === 'left') { 
            pushToX = newX - 1; 
            pushDirection = 'left';
          }
          else if (newDirection === 'right') { 
            pushToX = newX + 1; 
            pushDirection = 'right';
          }
          else return { ...prevState, diggerDirection: newDirection }; // Just update direction if can't push vertically

          if (pushToX >= 0 && pushToX < GRID_WIDTH && currentGrid[pushToY]?.[pushToX] === CellType.Tunnel) {
            const bagIndex = prevState.goldBags.findIndex(b => b.pos.x === newX && b.pos.y === newY);
            if (bagIndex === -1) return { ...prevState, diggerDirection: newDirection };

            const updatedGoldBags = [...prevState.goldBags];
            updatedGoldBags[bagIndex] = { ...updatedGoldBags[bagIndex], pos: { x: pushToX, y: pushToY }, isFalling: false, fallDistance: 0 };

            if (newGrid[y]?.[x] === CellType.Digger) newGrid[y][x] = CellType.Tunnel;
            newGrid[newY][newX] = CellType.Digger;
            newGrid[pushToY][pushToX] = CellType.Gold;

            stateUpdate = { ...stateUpdate, grid: newGrid, diggerPos: { x: newX, y: newY }, goldBags: updatedGoldBags };
          } else {
            return { ...prevState, diggerDirection: newDirection }; // Just update direction if can't push
          }
        } else {
          newEmeraldStreak = 0; // Reset emerald streak when not collecting emeralds
          return { ...prevState, diggerDirection: newDirection, emeraldStreak: newEmeraldStreak }; // Just update direction if can't move
        }

        // Handle portals in the movement logic
        let teleported = false;
        let teleportDestination: Position | null = null;

        // Check if digger stepped on a portal
        for (const portal of prevState.portals) {
          // Check entry portal
          if (newX === portal.entryPos.x && newY === portal.entryPos.y) {
            teleported = true;
            teleportDestination = { ...portal.exitPos };
            // Create particles at both entry and exit
            const entryParticles = createParticles(newX, newY, 'emerald');
            const exitParticles = createParticles(portal.exitPos.x, portal.exitPos.y, 'emerald');
            
            stateUpdate = {
              ...stateUpdate,
              particles: [...prevState.particles, ...entryParticles, ...exitParticles]
            };
            
            console.log('Teleported from', { x: newX, y: newY }, 'to', teleportDestination);
            break;
          }
          
          // Check exit portal (optional - for bidirectional teleportation)
          if (newX === portal.exitPos.x && newY === portal.exitPos.y) {
            teleported = true;
            teleportDestination = { ...portal.entryPos };
            // Create particles at both entry and exit
            const entryParticles = createParticles(portal.entryPos.x, portal.entryPos.y, 'emerald');
            const exitParticles = createParticles(newX, newY, 'emerald');
            
            stateUpdate = {
              ...stateUpdate,
              particles: [...prevState.particles, ...entryParticles, ...exitParticles]
            };
            
            console.log('Teleported from', { x: newX, y: newY }, 'to', teleportDestination);
            break;
          }
        }

        // Apply teleportation if needed
        if (teleported && teleportDestination) {
          newX = teleportDestination.x;
          newY = teleportDestination.y;
          
          // Screen shake when teleporting
          triggerScreenShake();
        }

        return { ...prevState, ...stateUpdate };
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameState.gameOver, gameState.diggerRespawning, gameState.levelCompleting, gameState.paused]);

  // Special effect to monitor digger movement and check for cherry collection
  // This is a separate effect from the main game loop
  useEffect(() => {
    if (!gameState.gameOver && !gameState.diggerRespawning && !gameState.levelCompleting && !gameState.paused && gameState.cherry.active) {
      const cherryX = gameState.cherry.pos.x;
      const cherryY = gameState.cherry.pos.y;
      const diggerX = gameState.diggerPos.x;
      const diggerY = gameState.diggerPos.y;
      
      if (cherryX === diggerX && cherryY === diggerY) {
        console.log("Cherry position matches Digger position! Collecting cherry from movement handler.");
        
        // Collect the cherry
        setGameState(prev => {
          return {
            ...prev,
            cherry: {
              pos: { x: -1, y: -1 },
              active: false,
              spawnTime: CHERRY_SPAWN_MIN + Math.floor(Math.random() * (CHERRY_SPAWN_MAX - CHERRY_SPAWN_MIN))
            },
            powerMode: POWER_MODE_DURATION,
            score: prev.score + CHERRY_POINTS,
            grid: prev.grid.map((row, y) => 
              row.map((cell, x) => 
                (x === cherryX && y === cherryY && cell === CellType.Cherry) ? CellType.Tunnel : cell
              )
            )
          };
        });
      }
    }
  }, [gameState.diggerPos.x, gameState.diggerPos.y, gameState.cherry.active, gameState.gameOver, gameState.diggerRespawning, gameState.levelCompleting, gameState.paused]);

  // Add function to create particles inside the Game component
  const createParticles = (x: number, y: number, type: 'gold' | 'emerald' | 'enemy' | 'cherry') => {
    const newParticles: Particle[] = [];
    const baseColors = {
      gold: ['#FFD700', '#FFC125', '#FFAA00'],
      emerald: ['#50C878', '#3CB371', '#2E8B57'],
      enemy: ['#FF6347', '#FF4500', '#FF0000'],
      cherry: ['#FF0000', '#DC143C', '#8B0000']
    };
    
    const colors = baseColors[type];
    
    for (let i = 0; i < PARTICLES_COUNT; i++) {
      newParticles.push({
        id: `particle-${Date.now()}-${i}`,
        x: x * 24 + 12, // Convert grid position to pixels
        y: y * 24 + 12,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 4,
        duration: 0.5 + Math.random() * 1.0,
        angle: Math.random() * Math.PI * 2,
        speed: 1 + Math.random() * 3
      });
    }
    
    return newParticles;
  };

  // Add a function to trigger screen shake
  const triggerScreenShake = () => {
    setGameState(prev => ({
      ...prev,
      shakeEffect: true
    }));
    
    // Reset shake after animation completes
    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        shakeEffect: false
      }));
    }, 500);
  };

  // --- Rendering Logic ---
  const renderCell = (cellType: CellType, x: number, y: number) => {
    let cellContent = null;
    let bgColor = 'bg-yellow-950'; // Dirt default

    const currentGridCell = gameState.grid[y]?.[x];
    switch (currentGridCell) {
      case CellType.Tunnel: bgColor = 'bg-black'; break;
      case CellType.Dirt: bgColor = 'bg-yellow-950'; break;
      case CellType.Cherry: bgColor = 'bg-black'; break;
    }

    const isDiggerPos = gameState.diggerPos.x === x && gameState.diggerPos.y === y;
    const goldBag = gameState.goldBags.find(bag => bag.pos.x === x && bag.pos.y === y);
    const goldNugget = gameState.goldNuggets.find(nugget => nugget.pos.x === x && nugget.pos.y === y);
    const emerald = gameState.emeralds.find(em => em.x === x && em.y === y);
    const enemy = gameState.enemies.find(en => en.pos.x === x && en.pos.y === y); 
    const fireball = gameState.fireballs.find(fb => fb.pos.x === x && fb.pos.y === y);
    const isCherry = gameState.cherry.active && gameState.cherry.pos.x === x && gameState.cherry.pos.y === y;

    // Check if there's a portal here first
    const entryPortal = gameState.portals.find(p => p.entryPos.x === x && p.entryPos.y === y);
    const exitPortal = gameState.portals.find(p => p.exitPos.x === x && p.exitPos.y === y);
    
    if (entryPortal || exitPortal) {
      const portal = entryPortal || exitPortal;
      let portalColor = 'bg-blue-500';
      
      switch (portal?.color) {
        case 'blue':
          portalColor = 'bg-blue-600';
          break;
        case 'orange':
          portalColor = 'bg-orange-500';
          break;
        case 'green':
          portalColor = 'bg-green-500';
          break;
        case 'purple':
          portalColor = 'bg-purple-500';
          break;
      }
      
      return (
        <motion.div
          key={`portal-${x}-${y}`}
          className={`w-6 h-6 ${portalColor} rounded-full flex items-center justify-center`}
          animate={{ 
            rotate: 360,
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            rotate: { duration: 4, repeat: Infinity, ease: "linear" },
            scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
          }}
        >
          <div className="w-3 h-3 bg-white rounded-full opacity-80"></div>
        </motion.div>
      );
    }

    // Render in priority order (top item is rendered)
    if (isDiggerPos && gameState.diggerRespawning) {
      bgColor = 'bg-black';
      cellContent = <div className="w-full h-full flex items-center justify-center text-blue-400 animate-ping">@</div>;
    } else if (isDiggerPos) {
      bgColor = 'bg-black';
      // Add some visual indicator of direction and power mode
      let diggerChar = 'D';
      switch (gameState.diggerDirection) {
        case 'up': diggerChar = '↑'; break;
        case 'down': diggerChar = '↓'; break;
        case 'left': diggerChar = '←'; break;
        case 'right': diggerChar = '→'; break;
      }
      const isPowered = gameState.powerMode > 0;
      cellContent = (
        <div 
          className={`w-full h-full flex items-center justify-center ${isPowered ? 'text-purple-300 animate-pulse' : 'text-red-500'} font-bold text-xl`}
        >
          {diggerChar}
        </div>
      );
    } else if (fireball) {
      // Render fireball with animation effects
      bgColor = 'bg-black';
      cellContent = (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse shadow-lg shadow-orange-300"></div>
        </div>
      );
    } else if (enemy) {
      bgColor = 'bg-black';
      // Updated enemy rendering with different visuals for Hobbin and power mode
      const enemyColor = enemy.type === EnemyType.Nobbin ? 'text-green-500' : 'text-red-500';
      const enemyText = enemy.type === EnemyType.Nobbin ? 'N' : 'H';
      
      // Add visual cue for enemies that are vulnerable in power mode
      const isPowerMode = gameState.powerMode > 0;
      
      cellContent = (
        <div className={`w-full h-full flex items-center justify-center ${enemyColor} font-bold text-lg relative ${isPowerMode ? 'opacity-60 animate-pulse' : ''}`}>
          {enemyText}
          {enemy.type === EnemyType.Nobbin && enemy.transformTimer < HOBBIN_TRANSFORM_TIME / 2 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
              <div 
                className="h-full bg-red-500" 
                style={{ width: `${(1 - enemy.transformTimer / HOBBIN_TRANSFORM_TIME) * 100}%` }} 
              />
            </div>
          )}
          {isPowerMode && (
            <div className="absolute inset-0 border-2 border-blue-300 opacity-50 rounded-sm"></div>
          )}
        </div>
      );
    } else if (goldBag) {
      bgColor = 'bg-black';
      const fallingClass = goldBag.isFalling ? 'animate-bounce' : '';
      cellContent = (
        <div className={`w-full h-full flex items-center justify-center text-yellow-500 ${fallingClass}`}>
          <span className="text-lg">{isClient ? '💰' : 'G'}</span>
        </div>
      );
    } else if (goldNugget) {
      // Render gold nugget (the collectible that appears when bags break)
      bgColor = 'bg-black';
      cellContent = (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-yellow-400 text-lg animate-pulse">
            {isClient ? '$' : 'G'}
          </div>
        </div>
      );
    } else if (isCherry) {
      // Render the bonus cherry
      bgColor = 'bg-black';
      cellContent = (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-xl animate-bounce text-red-500">
            {isClient ? '🍒' : 'C'}
          </div>
        </div>
      );
    } else if (emerald) {
      bgColor = 'bg-black';
      cellContent = (
        <div className="w-full h-full flex items-center justify-center text-green-400 text-lg animate-pulse">
          {isClient ? '💎' : 'E'}
        </div>
      );
    } else if (currentGridCell === CellType.Tunnel) {
      cellContent = <div className="w-full h-full bg-black"></div>;
    } else if (currentGridCell === CellType.Dirt) {
      cellContent = <div className="w-full h-full bg-yellow-950"></div>;
    }

    return (
      <div
        key={`${x}-${y}`}
        className={`w-6 h-6 border border-gray-800 ${bgColor} relative overflow-hidden`}
      >
        {cellContent}
      </div>
    );
  };

  // --- JSX Return ---
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-black overflow-hidden">
      {/* Background stars - only render on client */}
      {isClient && (
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={`star-${i}`}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.7 + 0.3,
                animation: `twinkle ${Math.random() * 5 + 2}s infinite`
              }}
            />
          ))}
        </div>
      )}
      
      {/* Add blur glow effects - only on client */}
      {isClient && (
        <>
          <div className="absolute top-1/4 left-1/4 w-40 h-40 bg-blue-500 rounded-full filter blur-3xl opacity-10"></div>
          <div className="absolute bottom-1/4 right-1/4 w-60 h-60 bg-purple-500 rounded-full filter blur-3xl opacity-10"></div>
        </>
      )}
      
      {/* Game title - conditional animation */}
      {isClient ? (
        <motion.h1 
          className="text-4xl font-bold mb-8 text-white drop-shadow-lg"
          animate={{ y: [0, -5, 0], textShadow: ['0 0 10px #fff', '0 0 20px #fff', '0 0 10px #fff'] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          DIGGER REMASTERED
        </motion.h1>
      ) : (
        <h1 className="text-4xl font-bold mb-8 text-white drop-shadow-lg">
          DIGGER REMASTERED
        </h1>
      )}
      
      {/* Scoreboard Area */}
      <div className="mb-4 p-2 border-2 border-gray-500 bg-gray-900 rounded backdrop-blur-sm bg-opacity-75 shadow-lg">
        <span className="mr-4">Score: {String(gameState.score).padStart(6, '0')}</span>
        <span className="mr-4">Lives: {isClient ? '❤️'.repeat(gameState.lives) : `♥ x${gameState.lives}`}</span>
        <span className="mr-4">Level: {gameState.level}</span>
        <span className="mr-4">
          Emerald Streak: <span className={gameState.emeraldStreak > 1 ? 'text-green-500 font-bold' : ''}>
            {gameState.emeraldStreak}x
          </span>
        </span>
        {gameState.powerMode > 0 && (
          <span className="mr-4 text-purple-400 font-bold animate-pulse">
            POWER: {Math.ceil(gameState.powerMode * TICK_RATE_MS / 1000)}s
          </span>
        )}
        <span className={gameState.fireballCooldown > 0 ? 'opacity-50' : 'text-orange-500'}>
          Fire: {gameState.fireballCooldown > 0 ? `(${gameState.fireballCooldown})` : 'READY'}
        </span>
      </div>

      {/* Instructions */}
      <div className="text-xs mb-2 text-gray-400">
        Arrow Keys: Move | F: Fire | Space: Pause
      </div>

      {/* Render the game grid with fancy container */}
      <div className="relative">
        <div className="grid border-4 rounded-lg border-gray-600 shadow-lg" 
             style={{ gridTemplateColumns: `repeat(${GRID_WIDTH}, minmax(0, 1fr))` }}>
          {gameState.grid.map((row: CellType[], y: number) =>
            row.map((cell: CellType, x: number) => renderCell(cell, x, y))
          )}
        </div>
        
        {/* Render particles on top of the grid */}
        {gameState.particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full z-50"
            initial={{ 
              left: particle.x, 
              top: particle.y,
              opacity: 1,
              scale: 1,
              backgroundColor: particle.color,
              width: particle.size,
              height: particle.size
            }}
            animate={{ 
              left: particle.x + Math.cos(particle.angle) * 50 * particle.speed,
              top: particle.y + Math.sin(particle.angle) * 50 * particle.speed,
              opacity: 0,
              scale: 0
            }}
            transition={{ duration: particle.duration }}
          />
        ))}
      </div>

      {/* Game Over Overlay */}
      <AnimatePresence>
        {gameState.gameOver && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center text-4xl text-red-500 font-bold z-10 backdrop-blur-sm"
          >
            <div className="text-6xl mb-4 text-red-500 animate-pulse">GAME OVER</div>
            <div className="text-xl mt-4 text-yellow-400">Final Score: {gameState.score}</div>
            <motion.button 
              className="mt-8 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xl rounded-lg shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const initialLevel = generateInitialLevel();
                setGameState({
                  ...initialLevel,
                  score: 0,
                  lives: INITIAL_LIVES,
                  level: 1,
                  gameOver: false,
                  diggerRespawning: false,
                  fireballCooldown: 0,
                  emeraldStreak: 0,
                  levelCompleting: false,
                  levelTransitionTimer: 0,
                  paused: false,
                  powerMode: 0,
                  particles: [],
                  shakeEffect: false,
                  powerUps: [],
                  activeSpeedBoost: false,
                  timeFreeze: false,
                  superFireball: false
                });
              }}
            >
              Play Again
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Similar animation for Level Complete overlay */}
      <AnimatePresence>
        {gameState.levelCompleting && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex flex-col items-center justify-center text-4xl text-green-500 font-bold z-10"
          >
            <motion.div 
              animate={{ y: [0, -10, 0] }} 
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-5xl text-green-500 shadow-green-500 drop-shadow-lg"
            >
              LEVEL {gameState.level} COMPLETE!
            </motion.div>
            <div className="text-xl mt-4 text-yellow-400">Score: {gameState.score}</div>
            <div className="text-md mt-2 text-white">
              Next level in {Math.ceil(gameState.levelTransitionTimer * TICK_RATE_MS / 1000)} seconds...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pause Overlay */}
      <AnimatePresence>
        {gameState.paused && !gameState.gameOver && !gameState.levelCompleting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex flex-col items-center justify-center text-4xl text-blue-500 font-bold z-10"
          >
            <div className="text-5xl">PAUSED</div>
            <div className="text-lg mt-4 text-white">Press SPACE to continue</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sound manager */}
      <SoundManager gameState={gameState} prevGameState={prevGameStateRef.current} />

      {/* Add custom CSS animation */}
      <style jsx global>{`
        @keyframes twinkle {
          0% { opacity: 0.3; }
          50% { opacity: 1; }
          100% { opacity: 0.3; }
        }
        
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

// --- Helper to get start position ---
const getStartPosition = (): Position => {
  // In a real game, this might depend on the level
  return { x: 1, y: 1 };
};

// --- Initial Level Generation ---
function generateInitialLevel(level: number = 1): Pick<GameState, 'grid' | 'diggerPos' | 'diggerDirection' | 'goldBags' | 'goldNuggets' | 'emeralds' | 'enemies' | 'fireballs' | 'cherry' | 'portals' | 'particles' | 'powerUps' | 'activeSpeedBoost' | 'timeFreeze' | 'superFireball'> {
  const grid = Array.from({ length: GRID_HEIGHT }, () =>
    Array(GRID_WIDTH).fill(CellType.Dirt)
  );

  const startPos = getStartPosition(); // Use helper
  grid[startPos.y][startPos.x] = CellType.Digger;

  // Create some tunnels - more tunnels in higher levels
  const baseTunnels = [
    { x: 1, y: 2 },
    { x: 2, y: 1 },
    { x: 2, y: 2 }
  ];
  
  // Add more tunnels as levels increase
  const additionalTunnels = [];
  for (let i = 0; i < level * 2; i++) {
    additionalTunnels.push({
      x: 3 + Math.floor(Math.random() * (GRID_WIDTH - 6)),
      y: 3 + Math.floor(Math.random() * (GRID_HEIGHT - 6))
    });
  }
  
  // Create all tunnels
  [...baseTunnels, ...additionalTunnels].forEach(pos => {
    if (grid[pos.y]?.[pos.x] !== undefined) {
      grid[pos.y][pos.x] = CellType.Tunnel;
    }
  });

  // More emeralds in higher levels
  const emeraldCount = 6 + (level - 1) * 2; // Start with 6, add 2 per level
  const emeralds: Position[] = [];
  
  for (let i = 0; i < emeraldCount; i++) {
    const emeraldX = 5 + Math.floor(Math.random() * (GRID_WIDTH - 10));
    const emeraldY = 3 + Math.floor(Math.random() * (GRID_HEIGHT - 6));
    emeralds.push({ x: emeraldX, y: emeraldY });
  }
  
  emeralds.forEach(pos => {
    if (grid[pos.y]?.[pos.x] !== undefined) {
      grid[pos.y][pos.x] = CellType.Emerald;
    }
  });

  // More gold bags in higher levels
  const bagCount = 4 + Math.floor((level - 1) / 2); // Add a bag every 2 levels
  const goldBags: GoldBagState[] = [];
  
  for (let i = 0; i < bagCount; i++) {
    const bagX = 6 + Math.floor(Math.random() * (GRID_WIDTH - 12));
    const bagY = 4 + Math.floor(Math.random() * (GRID_HEIGHT - 8));
    goldBags.push({ 
      id: `bag${i}-lvl${level}`, 
      pos: { x: bagX, y: bagY }, 
      isFalling: false, 
      fallDistance: 0 
    });
  }
  
  goldBags.forEach(bag => {
    if (grid[bag.pos.y]?.[bag.pos.x] !== undefined) {
      grid[bag.pos.y][bag.pos.x] = CellType.Gold;
    }
  });

  // Create tunnels under some bags to allow them to fall
  goldBags.forEach((bag, idx) => {
    if (idx % 2 === 0 && grid[bag.pos.y + 1]?.[bag.pos.x] !== undefined) {
      grid[bag.pos.y + 1][bag.pos.x] = CellType.Tunnel;
    }
  });

  // More enemies in higher levels (and higher chance of starting as Hobbins)
  const enemyCount = 2 + Math.floor(level / 2); // Add enemy every 2 levels
  const enemies: EnemyState[] = [];
  
  // Base enemies in corners
  enemies.push({
    id: `nob1-lvl${level}`, 
    pos: { x: GRID_WIDTH - 2, y: 1 }, 
    type: EnemyType.Nobbin, 
    direction: 'left',
    transformTimer: HOBBIN_TRANSFORM_TIME - (level * 5) // Transform faster in higher levels
  });
  
  enemies.push({
    id: `nob2-lvl${level}`, 
    pos: { x: 1, y: GRID_HEIGHT - 2 }, 
    type: EnemyType.Nobbin, 
    direction: 'up',
    transformTimer: HOBBIN_TRANSFORM_TIME - (level * 5)
  });
  
  // Add additional enemies for higher levels
  for (let i = 2; i < enemyCount; i++) {
    const startAsHobbin = Math.random() < (level * 0.1); // Higher chance in higher levels
    const enemyX = 5 + Math.floor(Math.random() * (GRID_WIDTH - 10));
    const enemyY = 5 + Math.floor(Math.random() * (GRID_HEIGHT - 10));
    
    enemies.push({
      id: `enemy${i}-lvl${level}`,
      pos: { x: enemyX, y: enemyY },
      type: startAsHobbin ? EnemyType.Hobbin : EnemyType.Nobbin,
      direction: ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)] as Direction,
      transformTimer: startAsHobbin ? 0 : HOBBIN_TRANSFORM_TIME - (level * 5)
    });
  }
  
  // Create tunnels for enemies to spawn in
  grid[1][GRID_WIDTH - 2] = CellType.Tunnel;
  grid[1][GRID_WIDTH - 1] = CellType.Tunnel; // Give space
  grid[GRID_HEIGHT - 2][1] = CellType.Tunnel;
  grid[GRID_HEIGHT - 1][1] = CellType.Tunnel; // Give space
  
  // Create tunnels for additional enemies
  enemies.slice(2).forEach(enemy => {
    grid[enemy.pos.y][enemy.pos.x] = CellType.Tunnel;
  });

  // Generate portals
  const portals = generatePortals(grid);

  // In generateInitialLevel, make sure to return all the properties defined in the function signature
  return { 
    grid, 
    diggerPos: startPos, 
    diggerDirection: 'right', // Initial direction
    goldBags, 
    goldNuggets: [], // Start with no gold nuggets
    emeralds, 
    enemies,
    fireballs: [], // Start with no fireballs
    cherry: {
      pos: { x: -1, y: -1 }, // Off-screen position
      active: false,
      spawnTime: CHERRY_SPAWN_MIN + Math.floor(Math.random() * (CHERRY_SPAWN_MAX - CHERRY_SPAWN_MIN))
    },
    particles: [], // Start with no particles
    powerUps: [],
    activeSpeedBoost: false,
    timeFreeze: false,
    superFireball: false,
    portals,
  };
}

// In generateInitialLevel, add portals to the returned state
const generatePortals = (grid: CellType[][]): Portal[] => {
  const portals: Portal[] = [];
  const colors = ['blue', 'orange', 'green', 'purple'];
  
  // Try to place 2 portal pairs
  for (let i = 0; i < 2; i++) {
    // Find valid positions for entry and exit (must be tunnel)
    const validPositions: Position[] = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        if (grid[y][x] === CellType.Tunnel) {
          // Check if position is not already used for another portal
          if (!portals.some(p => 
            (p.entryPos.x === x && p.entryPos.y === y) || 
            (p.exitPos.x === x && p.exitPos.y === y))) {
            validPositions.push({ x, y });
          }
        }
      }
    }
    
    // We need at least 2 valid positions for a portal pair
    if (validPositions.length < 2) break;
    
    // Pick entry position and remove it from valid positions
    const entryIndex = Math.floor(Math.random() * validPositions.length);
    const entryPos = validPositions[entryIndex];
    validPositions.splice(entryIndex, 1);
    
    // Pick exit position
    const exitIndex = Math.floor(Math.random() * validPositions.length);
    const exitPos = validPositions[exitIndex];
    
    // Add portal pair with a color
    portals.push({
      entryPos,
      exitPos,
      color: colors[i % colors.length]
    });
  }
  
  return portals;
};

// Export the wrapped component
export default function WrappedGame() {
  return (
    <ClientOnly>
      <Game />
    </ClientOnly>
  );
}