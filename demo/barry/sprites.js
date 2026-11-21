/* ============================================================
   sprites.js: every sprite Barry uses
   ------------------------------------------------------------
   w, h    = size of ONE frame in art pixels (not screen pixels)
   frames  = how many frames sit side by side in the PNG strip
   frameMs = ms per frame for animated strips (optional)

   Rebuild the PNGs with the art team's tools/build_sprites.py (lives with the art team, not in this repo)
   ============================================================ */

// Where the PNGs live.
//   demo (opened from demo/index.html):  "../public/assets/sprites/"
//   Chrome extension content script:     chrome.runtime.getURL("assets/sprites/")
const SPRITE_DIR = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL)
  ? chrome.runtime.getURL("assets/sprites/")
  : "../public/assets/sprites/";

const S = 4;   // screen scale: 1 art pixel = 4 screen pixels. Keep an integer so pixels stay crisp.

const ASSETS = {
  "arm": { w: 54, h: 54, frames: 1 },                                         // unused (arm is drawn in code)
  "barry-chill-mug": { w: 17, h: 20, frames: 13, frameMs: 220 },              // chill idle (sipping)
  "barry-chill": { w: 29, h: 18, frames: 1 },                                 // slack pass active (lounging)
  "barry-chud-point": { w: 50, h: 50, frames: 1 },                            // "I'm a chud" dance (max chud meter) · PNG is saved at 4x
  "barry-chud": { w: 50, h: 50, frames: 1 },                                  // 5th eaten click
  "barry-close-tab": { w: 17, h: 20, frames: 1 },                             // arm reach body (back to it, slack over)
  "barry-default": { w: 17, h: 20, frames: 1 },                               // get-up pause, standing after the get-up jump, cave send-off hop
  "barry-fat-1": { w: 22, h: 25, frames: 1 },                                 // eaten click 1
  "barry-fat-2": { w: 28, h: 28, frames: 1 },                                 // eaten click 2
  "barry-fat-3": { w: 35, h: 33, frames: 1 },                                 // eaten click 3
  "barry-fat-4": { w: 42, h: 38, frames: 1 },                                 // eaten click 4
  "barry-get-up-2": { w: 28, h: 19, frames: 1 },                              // getting up, frame 2
  "barry-get-up": { w: 29, h: 17, frames: 1 },                                // getting up, frame 1
  "barry-got-owned": { w: 30, h: 14, frames: 1 },                             // after 5th punch (5 s on the ground)
  "barry-grieved": { w: 17, h: 20, frames: 1 },                               // after 5th punch ("my arm hurts")
  "barry-happy": { w: 21, h: 21, frames: 1 },                                 // let barry out (cave), tired → get up jump
  "barry-point": { w: 17, h: 20, frames: 1 },                                 // unused (old slim pointing pose)
  "barry-studious": { w: 18, h: 20, frames: 14, frameMs: 180 },               // lock-in on task (reading, page flip)
  "barry-suspicious-tap": { w: 17, h: 20, frames: 6, frameMs: 130 },          // slack warning (foot tapping)
  "barry-suspicious": { w: 17, h: 20, frames: 1 },                            // burst in, "Okay... -_-", "ow"
  "barry-thinking": { w: 17, h: 20, frames: 1 },                              // free-gap suggestion
  "barry-tired": { w: 18, h: 23, frames: 1 },                                 // sits after getting owned
  "barry-workout": { w: 47, h: 24, frames: 1 },                               // unused (lifting weights)
  "bubble": { w: 30, h: 19, frames: 1 },                                      // unused (bubble is CSS)
  "chud-bar": { w: 35, h: 5, frames: 1 },                                     // chud meter outline
  "icon-clock": { w: 7, h: 7, frames: 1 },                                    // slack countdown in bubble
};
for (const [name, a] of Object.entries(ASSETS)) a.src = SPRITE_DIR + name + ".png";

// Where Barry's paw is (art pixels from the sprite's top-left), so the stretchy arm starts there.
const PAW = {
  "barry-close-tab": [2, 14], "barry-chud": [3, 34],
  "barry-fat-1": [2, 13], "barry-fat-2": [2, 14], "barry-fat-3": [2, 16], "barry-fat-4": [2, 17],
};
