// World coordinates are permanent. Add future maps to this registry.
export const WORLD = Object.freeze({ width: 1600, height: 900 });
export const maps = Object.freeze([{ id: 'first-clearing', name: 'The first clearing', seed: 2417,
  path: [[-70,450],[175,450],[280,350],[440,350],[540,490],[720,490],[830,310],[1020,310],[1135,470],[1110,620],[1285,675],[1670,675]],
  pond: {x:790,y:710,rx:145,ry:70}
}]);
export function fitViewport(width,height){ const scale=Math.min(width/WORLD.width,height/WORLD.height);return {scale,x:(width-WORLD.width*scale)/2,y:(height-WORLD.height*scale)/2}; }
export function random(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
