// Every number that sets the feel of the star graph. Tune here; StarGraph, StarNode, StarEdge and the physics
// (lib/starPhysics.js) all read from this file. Distances are screen pixels.

// --- cursor field: the cursor gently pushes nearby stars away ---------------------------------------------------
export const INTERACTION_RADIUS = 140 // stars farther than this from the cursor don't move
export const MAX_DISPLACEMENT = 16 // px a star is pushed at the strongest point (the real peak, not just a bound)
export const REPULSION_STRENGTH = 1 // scales the push (1 = MAX_DISPLACEMENT at the peak; 0 turns the field off)
export const CORE_RADIUS = 14 // closer than this the push fades out, so a star under the cursor holds still and can be hovered

// --- springs: how stars move toward where the field (and their resting spot) wants them ---------------------------
export const SPRING_STRENGTH = 0.025 // pull toward the target position, per frame at 60fps (lower = softer, floatier)
export const DAMPING = 0.85 // velocity kept each frame (lower = calmer and stiffer, higher = floatier and looser)
export const NEIGHBOR_FOLLOW = 0.22 // share of a connected star's displacement that a neighbor copies (invisible springs)
export const POINTER_SMOOTHING = 0.3 // how quickly the cursor position and the field's strength ease in and out

// --- idle drift: a barely-there ambient float ---------------------------------------------------------------------
export const IDLE_DRIFT_AMOUNT = 2.2 // px, the farthest a star wanders from its resting spot when nothing is happening
export const IDLE_DRIFT_MIN_HZ = 0.03 // each star drifts at its own slow speed between these two frequencies
export const IDLE_DRIFT_MAX_HZ = 0.08

// --- hover emphasis --------------------------------------------------------------------------------------------------
export const HOVER_SCALE = 1.25 // size of the hovered star (selected stars use it too)
export const NEIGHBOR_OPACITY = 0.85 // direct neighbors of the hovered star
export const DIMMED_OPACITY = 0.4 // everything else (the constellation stays visible)
export const TRANSITION_MS = 220 // fades and scale changes
export const EDGE_REVEAL_MS = 280 // a connection drawing itself from the hovered star outward
