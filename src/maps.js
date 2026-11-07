// World coordinates are permanent. Add future maps to this registry.
export const WORLD = Object.freeze({ width: 900, height: 1800 });
export const maps = Object.freeze([{ id: 'first-clearing', name: 'The first clearing', seed: 2417,
  path: [[450,-80],[450,230],[260,360],[260,550],[620,700],[620,920],[310,1070],[310,1280],[570,1430],[570,1880]],
  pond: {x:710,y:1190,rx:125,ry:80}
}]);
export function fitViewport(width,height){ const scale=Math.min(width/WORLD.width,height/WORLD.height);return {scale,x:(width-WORLD.width*scale)/2,y:(height-WORLD.height*scale)/2}; }
export function random(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
