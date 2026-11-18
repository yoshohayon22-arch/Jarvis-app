<script>
"use strict";
/* =====================================================================
   ART — décors et portraits stylisés en SVG (aucune photo, rien de photoréaliste)
   ===================================================================== */
const ART = {};
(function(){
  let uid = 0;
  const id = p => p + (++uid);
  function sky(g, top, bottom){ return `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="1200" height="330" fill="url(#${g})"/>`; }
  function stars(n, seed, maxY){ let s = ""; let x = seed; for(let i=0;i<n;i++){ x = (x*9301+49297)%233280; const px = x/233280*1200; x = (x*9301+49297)%233280; const py = x/233280*maxY; s += `<circle cx="${px.toFixed(0)}" cy="${py.toFixed(0)}" r="${i%5?1:1.6}" fill="#fff" opacity="${i%3?0.5:0.85}"/>`; } return s; }
  const wrap = inner => `<svg viewBox="0 0 1200 330" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">${inner}</svg>`;

  ART.scenes = {
    paris(){ const g = id("sk");
      return wrap(sky(g,"#1b2442","#c9875a") + stars(40,7,150) +
      `<circle cx="960" cy="230" r="46" fill="#f3c27a" opacity=".55"/>
       <path d="M0 250 L1200 250 L1200 330 L0 330Z" fill="#0d1420"/>
       <g fill="#121a2a">
        <rect x="120" y="170" width="760" height="85"/>
        <rect x="430" y="130" width="140" height="125"/><path d="M430 130 Q500 70 570 130Z"/>
        <rect x="150" y="150" width="90" height="105"/><path d="M150 150 L195 118 L240 150Z"/>
        <rect x="760" y="150" width="90" height="105"/><path d="M760 150 L805 118 L850 150Z"/>
        <rect x="960" y="120" width="26" height="135"/><path d="M955 120 L973 70 L991 120Z"/>
       </g>
       <g fill="#e9b765" opacity=".75">${Array.from({length:22},(_,i)=>`<rect x="${140+i*33}" y="196" width="10" height="16"/>`).join("")}</g>
       <path d="M0 268 Q300 258 600 268 T1200 268 L1200 330 L0 330Z" fill="#1b2a44" opacity=".9"/>
       <g stroke="#e9b765" stroke-width="2" opacity=".35">${Array.from({length:14},(_,i)=>`<line x1="${60+i*85}" y1="${284+(i%3)*6}" x2="${100+i*85}" y2="${284+(i%3)*6}"/>`).join("")}</g>`); },
    italie(){ const g = id("sk");
      return wrap(sky(g,"#7fa6c9","#f0d9a8") +
      `<path d="M0 220 L140 90 L230 170 L360 60 L470 180 L590 80 L720 190 L860 70 L980 170 L1100 100 L1200 160 L1200 330 L0 330Z" fill="#6a7f8f"/>
       <path d="M140 90 L175 122 L150 118 L120 110Z M360 60 L400 98 L370 92 L330 90Z M590 80 L625 112 L600 108 L560 106Z M860 70 L900 104 L870 100 L830 98Z" fill="#f4f1ea"/>
       <path d="M0 250 Q300 215 600 245 T1200 235 L1200 330 L0 330Z" fill="#7d8f4f"/>
       <path d="M0 285 Q400 260 800 285 T1200 280 L1200 330 L0 330Z" fill="#5c6d36"/>
       <g fill="#33421d">${Array.from({length:12},(_,i)=>`<ellipse cx="${80+i*95}" cy="${250-(i%2)*8}" rx="9" ry="34"/>`).join("")}</g>`); },
    desert(){ const g = id("sk");
      return wrap(sky(g,"#e3a35b","#f6dfa6") +
      `<circle cx="880" cy="110" r="60" fill="#fff1c4" opacity=".9"/>
       <path d="M380 250 L520 90 L660 250Z" fill="#c58a46"/><path d="M520 90 L660 250 L560 250Z" fill="#a86f34"/>
       <path d="M640 250 L740 140 L840 250Z" fill="#c58a46"/><path d="M740 140 L840 250 L770 250Z" fill="#a86f34"/>
       <path d="M250 250 L310 190 L370 250Z" fill="#c58a46"/>
       <path d="M0 240 Q250 210 520 245 T1200 230 L1200 330 L0 330Z" fill="#d9aa62"/>
       <path d="M0 290 Q300 255 650 290 T1200 285 L1200 330 L0 330Z" fill="#c4914b"/>
       <g fill="#4b3218"><rect x="120" y="230" width="4" height="40"/><path d="M122 232 q-24 -6 -34 6 q18 -4 34 -2 q-10 -14 6 -22 q2 12 -4 20 q20 -10 32 4 q-16 -4 -34 -6z"/></g>`); },
    neige(){ const g = id("sk");
      return wrap(sky(g,"#3a3f4c","#a98b80") +
      `<path d="M0 200 L1200 200 L1200 330 L0 330Z" fill="#9aa1ad"/>
       <g fill="#2a2730">
        <rect x="560" y="120" width="40" height="90"/><path d="M560 120 Q580 70 600 120Z"/><rect x="578" y="56" width="4" height="22"/>
        <rect x="640" y="140" width="30" height="70"/><path d="M640 140 Q655 102 670 140Z"/>
        <rect x="500" y="150" width="34" height="60"/><path d="M500 150 Q517 112 534 150Z"/>
        <rect x="420" y="170" width="360" height="40"/>
       </g>
       <ellipse cx="600" cy="175" rx="300" ry="70" fill="#d8562c" opacity=".28"/>
       <path d="M0 240 Q300 215 600 240 T1200 235 L1200 330 L0 330Z" fill="#dfe4ea"/>
       <path d="M0 290 Q350 268 700 292 T1200 288 L1200 330 L0 330Z" fill="#f2f4f7"/>
       <g fill="#fff" opacity=".8">${Array.from({length:70},(_,i)=>`<circle cx="${(i*173)%1200}" cy="${(i*97)%300}" r="${1+i%3}"/>`).join("")}</g>`); },
    mer(){ const g = id("sk");
      return wrap(sky(g,"#2c4a63","#c6b48f") +
      `<circle cx="300" cy="120" r="34" fill="#f7e3b0" opacity=".7"/>
       <path d="M640 230 L720 120 L780 150 L860 90 L960 180 L1040 230Z" fill="#3b4636"/>
       <path d="M0 225 L1200 225 L1200 330 L0 330Z" fill="#1f3c55"/>
       <g stroke="#9cc0d6" stroke-width="2" opacity=".45" fill="none">${Array.from({length:16},(_,i)=>`<path d="M${(i*80)%1200} ${245+(i%4)*20} q20 -8 40 0 t40 0"/>`).join("")}</g>
       <g fill="#1a1a1a"><path d="M300 236 L380 236 L370 248 L310 248Z"/><rect x="338" y="180" width="3" height="56"/><path d="M341 184 L372 226 L341 226Z" fill="#d9d3c2"/></g>`); },
    camp(){ const g = id("sk");
      return wrap(sky(g,"#2b3a4a","#d99c6a") + stars(18,3,90) +
      `<path d="M0 210 Q300 170 600 205 T1200 195 L1200 330 L0 330Z" fill="#3b4a35"/>
       <path d="M0 260 Q400 235 800 262 T1200 255 L1200 330 L0 330Z" fill="#2c3826"/>
       <g fill="#d8cdb3">${[150,260,370,780,900,1020].map(x=>`<path d="M${x} 262 L${x+45} 205 L${x+90} 262Z"/>`).join("")}</g>
       <g fill="#a39578">${[150,260,370,780,900,1020].map(x=>`<path d="M${x+45} 205 L${x+90} 262 L${x+52} 262Z"/>`).join("")}</g>
       <circle cx="600" cy="268" r="12" fill="#ffb14a"/><circle cx="600" cy="262" r="26" fill="#ffb14a" opacity=".25"/>
       <g fill="#8a8a8a" opacity=".35"><circle cx="606" cy="226" r="14"/><circle cx="616" cy="196" r="18"/><circle cx="630" cy="160" r="22"/></g>`); },
    bataille(){ const g = id("sk");
      return wrap(sky(g,"#4a4038","#b9a083") +
      `<g fill="#cfc4b2" opacity=".65"><circle cx="200" cy="170" r="70"/><circle cx="300" cy="140" r="90"/><circle cx="460" cy="170" r="80"/><circle cx="760" cy="150" r="100"/><circle cx="950" cy="175" r="80"/><circle cx="1080" cy="150" r="70"/></g>
       <path d="M0 235 Q300 210 600 232 T1200 228 L1200 330 L0 330Z" fill="#55603a"/>
       <path d="M0 280 Q350 262 700 282 T1200 278 L1200 330 L0 330Z" fill="#3d4628"/>
       <g fill="#1b1a17">
        <g transform="translate(240 262)"><circle r="16" fill="none" stroke="#1b1a17" stroke-width="4"/><rect x="-6" y="-14" width="90" height="12" transform="rotate(-12)"/></g>
        <g transform="translate(880 270)"><circle r="16" fill="none" stroke="#1b1a17" stroke-width="4"/><rect x="-84" y="-14" width="90" height="12" transform="rotate(12)"/></g>
       </g>
       <g><rect x="590" y="150" width="3" height="100" fill="#2b2420"/><path d="M593 152 h22 v34 h-22z" fill="#1f3b8a"/><path d="M615 152 h22 v34 h-22z" fill="#f2efe6"/><path d="M637 152 h22 v34 h-22z" fill="#b8202c"/></g>`); },
    palais(){ return wrap(
      `<rect width="1200" height="330" fill="#3a1418"/>
       <g fill="#5a1c22">${Array.from({length:8},(_,i)=>`<path d="M${i*160} 0 Q${i*160+80} 60 ${i*160+160} 0 L${i*160+150} 330 L${i*160+10} 330Z" opacity=".55"/>`).join("")}</g>
       <g fill="#c6a05a">${[120,330,870,1080].map(x=>`<rect x="${x}" y="40" width="34" height="270"/><rect x="${x-8}" y="30" width="50" height="14"/><rect x="${x-8}" y="300" width="50" height="14"/>`).join("")}</g>
       <circle cx="600" cy="150" r="78" fill="none" stroke="#d2a74b" stroke-width="6"/>
       <text x="600" y="186" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="104" fill="#d2a74b">N</text>
       <g fill="#d2a74b" opacity=".6">${Array.from({length:10},(_,i)=>`<ellipse cx="${200+i*90}" cy="${280+(i%2)*14}" rx="6" ry="9"/>`).join("")}</g>
       <rect y="312" width="1200" height="18" fill="#1d0b0d"/>`); },
    prison(){ const g = id("sk");
      return wrap(sky(g,"#2f3a3d","#8c8f86") +
      `<path d="M0 215 L1200 215 L1200 330 L0 330Z" fill="#26343a"/>
       <path d="M150 220 L260 110 L330 140 L430 70 L560 150 L640 120 L760 220Z" fill="#41493c"/>
       <g fill="#d8d2c2"><rect x="380" y="150" width="120" height="50"/><path d="M372 150 L440 122 L508 150Z" fill="#8a3b2e"/><rect x="400" y="168" width="14" height="18" fill="#3a3a3a"/><rect x="460" y="168" width="14" height="18" fill="#3a3a3a"/></g>
       <g stroke="#9cb2ba" stroke-width="2" opacity=".35" fill="none">${Array.from({length:12},(_,i)=>`<path d="M${(i*110)%1200} ${250+(i%3)*22} q22 -8 44 0 t44 0"/>`).join("")}</g>`); }
  };
  ART.scene = key => (ART.scenes[key] || ART.scenes.paris)();

  /* Portrait de Napoléon : médaillon, bicorne porté « en bataille », habit des chasseurs de la Garde.
     opts.age fait vieillir le trait (visage plus plein, tempes dégarnies). */
  ART.napoleon = function(opts = {}){
    const age = opts.age || 30; const old = Math.max(0, Math.min(1, (age - 33) / 18));
    const g = id("pg"), c = id("pc");
    const faceRx = 25 + old*4, jaw = 128 + old*4;
    const hair = old > .55 ? "#3b2c22" : "#4a3322";
    return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Portrait stylisé de Napoléon Bonaparte">
      <defs><radialGradient id="${g}" cx=".5" cy=".38" r=".7"><stop offset="0" stop-color="#3b5a46"/><stop offset="1" stop-color="#132219"/></radialGradient>
      <clipPath id="${c}"><circle cx="100" cy="115" r="92"/></clipPath></defs>
      <circle cx="100" cy="115" r="98" fill="#b88d36"/><circle cx="100" cy="115" r="94" fill="#e2c272"/>
      <circle cx="100" cy="115" r="92" fill="url(#${g})"/>
      <g clip-path="url(#${c})">
        <path d="M22 240 C30 178 66 160 100 160 C134 160 170 178 178 240Z" fill="#1d2b4c"/>
        <path d="M84 162 L100 214 L116 162 L108 158 L100 188 L92 158Z" fill="#efe9da"/>
        <path d="M70 158 Q100 182 130 158 L126 146 Q100 168 74 146Z" fill="#9a2633" stroke="#d2a74b" stroke-width="2"/>
        <ellipse cx="46" cy="182" rx="26" ry="9" fill="#d2a74b"/><ellipse cx="154" cy="182" rx="26" ry="9" fill="#d2a74b"/>
        <g stroke="#b88d36" stroke-width="1.5">${[0,1,2,3,4].map(i=>`<line x1="${30+i*8}" y1="188" x2="${28+i*8}" y2="202"/><line x1="${138+i*8}" y1="188" x2="${140+i*8}" y2="202"/>`).join("")}</g>
        <circle cx="122" cy="200" r="7" fill="#f0f0f0" stroke="#9a2633" stroke-width="2"/>
        <rect x="88" y="132" width="24" height="30" fill="#e8c9a6"/>
        <ellipse cx="100" cy="110" rx="${faceRx}" ry="31" fill="#eccfac"/>
        <path d="M${100-faceRx+2} 118 Q100 ${jaw+14} ${100+faceRx-2} 118" fill="#eccfac"/>
        ${old>.4?`<path d="M86 ${jaw+6} Q100 ${jaw+11} 114 ${jaw+6}" stroke="#c9a582" stroke-width="1.5" fill="none"/>`:""}
        <path d="M76 98 Q84 78 104 79 Q122 80 126 97 Q116 88 106 90 Q98 99 86 97Z" fill="${hair}"/>
        <path d="M98 86 Q92 100 98 106 Q99 96 106 89Z" fill="${hair}"/>
        <path d="M86 108 q6 -3 11 0" stroke="#3a2a1f" stroke-width="2" fill="none"/><path d="M104 108 q6 -3 11 0" stroke="#3a2a1f" stroke-width="2" fill="none"/>
        <ellipse cx="92" cy="114" rx="3" ry="2.2" fill="#2c3b4a"/><ellipse cx="109" cy="114" rx="3" ry="2.2" fill="#2c3b4a"/>
        <path d="M100 114 Q96 126 101 129" stroke="#b98d6a" stroke-width="2" fill="none"/>
        <path d="M93 137 Q100 139 108 137" stroke="#a5654f" stroke-width="2.2" fill="none"/>
        <path d="M30 92 Q100 34 170 92 Q134 76 100 79 Q66 76 30 92Z" fill="#101010"/>
        <path d="M34 90 Q100 44 166 90" stroke="#2a2a2a" stroke-width="2" fill="none"/>
        <circle cx="146" cy="76" r="8" fill="#1f3b8a"/><circle cx="146" cy="76" r="5.2" fill="#f2efe6"/><circle cx="146" cy="76" r="2.6" fill="#b8202c"/>
      </g>
      <circle cx="100" cy="115" r="92" fill="none" stroke="#7d5a1d" stroke-width="1.5"/>
    </svg>`;
  };

  /* Silhouettes d’attente pour les personnages des étapes suivantes */
  ART.placeholder = function(letter, c1, c2){
    const g = id("ph");
    return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><radialGradient id="${g}" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient></defs>
      <circle cx="100" cy="115" r="94" fill="url(#${g})" stroke="rgba(255,255,255,.25)" stroke-width="2"/>
      <ellipse cx="100" cy="100" rx="30" ry="36" fill="rgba(0,0,0,.35)"/>
      <path d="M38 210 C46 160 74 146 100 146 C126 146 154 160 162 210Z" fill="rgba(0,0,0,.35)"/>
      <text x="100" y="112" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="34" fill="rgba(255,255,255,.75)">${letter}</text>
    </svg>`;
  };
})();
</script>
