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
  ART.scenes.stade = function(){ const g = id("sk");
    return wrap(sky(g, "#0b1626", "#1d3a5c") + stars(26, 11, 110) +
    `<g fill="#f6f2d8" opacity=".9">${[90, 330, 870, 1110].map(x => `<rect x="${x - 3}" y="40" width="6" height="120" fill="#2a3a4d"/><rect x="${x - 34}" y="22" width="68" height="26" rx="4"/><path d="M${x - 34} 48 L${x - 150} 250 L${x + 150} 250 L${x + 34} 48Z" opacity=".08"/>`).join("")}</g>
     <path d="M0 150 Q600 96 1200 150 L1200 236 L0 236Z" fill="#15263a"/>
     <g fill="#d9dee6" opacity=".35">${Array.from({ length: 150 }, (_, i) => `<circle cx="${(i * 71) % 1200}" cy="${150 + (i * 37) % 78}" r="2.4"/>`).join("")}</g>
     <rect y="232" width="1200" height="8" fill="#c8102e"/>
     <path d="M0 240 L1200 240 L1200 330 L0 330Z" fill="#1f7a43"/>
     <g fill="#238a4c">${Array.from({ length: 6 }, (_, i) => `<rect x="${i * 200}" y="240" width="100" height="90"/>`).join("")}</g>
     <g stroke="#e9f3ea" stroke-width="3" fill="none" opacity=".85"><line x1="600" y1="240" x2="600" y2="330"/><ellipse cx="600" cy="300" rx="110" ry="34"/><path d="M0 262 H130 V330 M1200 262 H1070 V330"/></g>`); };
  ART.scenes.vestiaire = function(){ return wrap(
    `<rect width="1200" height="330" fill="#1b2430"/>
     <g>${Array.from({ length: 9 }, (_, i) => `<rect x="${40 + i * 128}" y="46" width="104" height="210" rx="4" fill="#243242" stroke="#324457" stroke-width="3"/><rect x="${56 + i * 128}" y="60" width="72" height="8" fill="#324457"/><path d="M${70 + i * 128} 86 h44 l10 16 -12 8 v70 h-40 v-70 l-12 -8z" fill="${i % 3 === 1 ? "#c8102e" : "#d9dee6"}" opacity=".85"/>`).join("")}</g>
     <rect y="256" width="1200" height="20" fill="#3a2c20"/><rect y="276" width="1200" height="54" fill="#141b24"/>`); };
  ART.scenes.plateau = function(){ return wrap(
    `<rect width="1200" height="330" fill="#101823"/>
     <g fill="#1b2a3c">${Array.from({ length: 12 }, (_, i) => `<rect x="${i * 100}" y="0" width="96" height="60"/><rect x="${i * 100}" y="64" width="96" height="60"/>`).join("")}</g>
     <g fill="#2b415c" opacity=".7">${Array.from({ length: 12 }, (_, i) => `<circle cx="${48 + i * 100}" cy="${i % 2 ? 30 : 94}" r="13"/>`).join("")}</g>
     <rect x="250" y="176" width="700" height="64" rx="4" fill="#243242"/><rect x="250" y="240" width="700" height="90" fill="#1a2532"/>
     <g fill="#0b1118">${[430, 600, 770].map(x => `<rect x="${x - 3}" y="140" width="6" height="40"/><rect x="${x - 12}" y="124" width="24" height="20" rx="8"/>`).join("")}</g>
     <g fill="#f6f2d8" opacity=".5">${[120, 1080].map(x => `<circle cx="${x}" cy="150" r="26"/><path d="M${x - 26} 150 L${x === 120 ? 420 : 780} 330 L${x === 120 ? 560 : 640} 330Z" opacity=".12"/>`).join("")}</g>`); };
  /* Footballeur stylisé : maillot uni aux couleurs du club, sans logo ni sponsor */
  ART.footballer = function(o = {}){
    const [c1, c2] = o.col || ["#c8102e", "#ffffff"]; const age = o.age || 20; const g = id("fg"), c = id("fc"); const old = age >= 36;
    return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Portrait stylisé d’un footballeur, numéro 7">
      <defs><radialGradient id="${g}" cx=".5" cy=".36" r=".72"><stop offset="0" stop-color="#2f5d86"/><stop offset="1" stop-color="#0b1a2b"/></radialGradient><clipPath id="${c}"><circle cx="100" cy="115" r="92"/></clipPath></defs>
      <circle cx="100" cy="115" r="98" fill="#cfd6df"/><circle cx="100" cy="115" r="92" fill="url(#${g})"/>
      <g clip-path="url(#${c})">
        <path d="M18 240 C24 176 62 158 100 158 C138 158 176 176 182 240Z" fill="${c1}"/>
        <path d="M82 158 Q100 178 118 158 L112 152 Q100 164 88 152Z" fill="${c2}"/>
        <path d="M18 240 C22 196 34 178 52 170 L60 240Z M182 240 C178 196 166 178 148 170 L140 240Z" fill="${c2}" opacity=".28"/>
        <text x="100" y="222" text-anchor="middle" font-family="Barlow Semi Condensed, Arial Narrow, sans-serif" font-weight="600" font-size="38" fill="${c2}">7</text>
        <rect x="88" y="130" width="24" height="32" fill="#d9a878"/>
        <ellipse cx="100" cy="106" rx="27" ry="33" fill="#e0b184"/>
        <path d="M73 100 Q72 68 100 66 Q128 68 127 100 Q122 82 112 80 Q100 76 88 80 Q78 82 73 100Z" fill="${old ? "#2a2522" : "#1c1612"}"/>
        <path d="M86 70 Q100 56 116 70 Q104 64 86 70Z" fill="${old ? "#2a2522" : "#1c1612"}"/>
        <path d="M84 102 q7 -4 13 0 M103 102 q7 -4 13 0" stroke="#1c1612" stroke-width="2.4" fill="none"/>
        <ellipse cx="91" cy="109" rx="3" ry="2.2" fill="#2a1c12"/><ellipse cx="109" cy="109" rx="3" ry="2.2" fill="#2a1c12"/>
        <path d="M100 109 Q97 122 101 125" stroke="#b98558" stroke-width="2" fill="none"/>
        <path d="M91 132 Q100 137 109 132" stroke="#8f4f3c" stroke-width="2.4" fill="none"/>
        ${old ? `<path d="M80 118 q-2 6 1 11 M120 118 q2 6 -1 11" stroke="#c39566" stroke-width="1.5" fill="none"/>` : ""}
      </g><circle cx="100" cy="115" r="92" fill="none" stroke="#7b8794" stroke-width="1.5"/></svg>`;
  };
  ART.scenes.bureau = function(){ return wrap(
    `<rect width="1200" height="330" fill="#e9e2cf"/>
     <g fill="#d9cfb4">${Array.from({ length: 7 }, (_, i) => `<rect x="${30 + i * 170}" y="0" width="150" height="330" opacity="${i % 2 ? .5 : .25}"/>`).join("")}</g>
     <g>${[330, 600, 870].map(x => `<rect x="${x - 70}" y="30" width="140" height="190" fill="#a9c4dc"/><path d="M${x - 70} 30 h140 v190 h-140z M${x} 30 v190 M${x - 70} 125 h140" fill="none" stroke="#f6f2e6" stroke-width="6"/><path d="M${x - 92} 20 q22 110 0 215 h22 q14 -105 0 -215z M${x + 92} 20 q-22 110 0 215 h-22 q-14 -105 0 -215z" fill="#b8963e"/>`).join("")}</g>
     <rect x="160" y="60" width="8" height="170" fill="#6b4a22"/><path d="M168 64 h70 v46 h-70z" fill="#b22234"/><path d="M168 64 h30 v24 h-30z" fill="#3c3b6e"/>
     <rect x="1032" y="60" width="8" height="170" fill="#6b4a22"/><path d="M1032 64 h-70 v46 h70z" fill="#1f3b6e"/>
     <rect x="380" y="226" width="440" height="60" rx="4" fill="#5a3a1c"/><rect x="396" y="286" width="408" height="44" fill="#4a2f16"/>
     <rect y="296" width="1200" height="34" fill="#31456b" opacity=".55"/>`); };
  ART.scenes.tribune = function(){ const g = id("sk");
    return wrap(sky(g, "#17233b", "#3a5a8c") +
    `<g>${Array.from({ length: 9 }, (_, i) => `<rect x="${60 + i * 130}" y="40" width="5" height="150" fill="#c9ced6"/><path d="M${65 + i * 130} 44 h64 v40 h-64z" fill="${i % 2 ? "#b22234" : "#f4f4f4"}"/><path d="M${65 + i * 130} 44 h26 v20 h-26z" fill="#3c3b6e"/>`).join("")}</g>
     <rect x="0" y="190" width="1200" height="60" fill="#22345a"/>
     <rect x="530" y="150" width="140" height="100" fill="#1b2a4a"/><rect x="560" y="120" width="80" height="34" rx="3" fill="#0f1a30"/><rect x="596" y="96" width="4" height="26" fill="#0b1220"/><rect x="606" y="100" width="4" height="22" fill="#0b1220"/>
     <g fill="#0d1526">${Array.from({ length: 60 }, (_, i) => `<circle cx="${10 + i * 20}" cy="${270 + (i % 3) * 14}" r="13"/>`).join("")}</g><rect y="290" width="1200" height="40" fill="#0d1526"/>`); };
  /* Homme d’État stylisé : costume sombre, cravate rouge, sans insigne */
  ART.statesman = function(o = {}){
    const g = id("sg"), c = id("sc"); const age = o.age || 70;
    return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Portrait stylisé d’un homme d’État en costume">
      <defs><radialGradient id="${g}" cx=".5" cy=".36" r=".72"><stop offset="0" stop-color="#3d5c94"/><stop offset="1" stop-color="#101b33"/></radialGradient><clipPath id="${c}"><circle cx="100" cy="115" r="92"/></clipPath></defs>
      <circle cx="100" cy="115" r="98" fill="#c9b27a"/><circle cx="100" cy="115" r="92" fill="url(#${g})"/>
      <g clip-path="url(#${c})">
        <path d="M14 240 C22 176 60 158 100 158 C140 158 178 176 186 240Z" fill="#1a2238"/>
        <path d="M80 160 L100 210 L120 160 L112 154 L100 176 L88 154Z" fill="#f4f1ea"/>
        <path d="M96 172 L104 172 L109 228 L100 240 L91 228Z" fill="#c1272d"/>
        <path d="M80 160 L62 176 L92 214Z M120 160 L138 176 L108 214Z" fill="#232d48"/>
        <rect x="88" y="132" width="24" height="30" fill="#e2b48c"/>
        <ellipse cx="100" cy="108" rx="29" ry="33" fill="#ecc19a"/>
        <path d="M70 100 Q66 66 100 64 Q136 64 132 98 Q126 80 108 78 Q92 76 82 84 Q74 90 70 100Z" fill="${age >= 76 ? "#ead9a8" : "#e6c56f"}"/>
        <path d="M74 88 Q96 62 130 82 Q110 70 74 88Z" fill="${age >= 76 ? "#f2e6c2" : "#f0d488"}"/>
        <path d="M82 104 q8 -4 14 0 M104 104 q8 -4 14 0" stroke="#b9925a" stroke-width="2.6" fill="none"/>
        <ellipse cx="90" cy="111" rx="3" ry="2" fill="#3a4c66"/><ellipse cx="110" cy="111" rx="3" ry="2" fill="#3a4c66"/>
        <path d="M100 111 Q96 124 101 127" stroke="#c4946a" stroke-width="2" fill="none"/>
        <path d="M91 136 Q100 133 109 136" stroke="#9a5a48" stroke-width="2.4" fill="none"/>
      </g><circle cx="100" cy="115" r="92" fill="none" stroke="#8a744a" stroke-width="1.5"/></svg>`;
  };
  ART.scenes.studio = function(){ return wrap(
    `<rect width="1200" height="330" fill="#160d2b"/>
     <g opacity=".5">${Array.from({ length: 8 }, (_, i) => `<path d="M${80 + i * 150} 0 L${20 + i * 150} 330 L${140 + i * 150} 330Z" fill="${i % 2 ? "#ff4fa3" : "#3ad0ff"}" opacity=".12"/>`).join("")}</g>
     <g fill="#0b0616">${[90, 300, 900, 1110].map(x => `<rect x="${x - 4}" y="0" width="8" height="70"/><rect x="${x - 26}" y="66" width="52" height="26" rx="5"/>`).join("")}</g>
     <g fill="#fff6d6" opacity=".9">${[90, 300, 900, 1110].map(x => `<rect x="${x - 20}" y="84" width="40" height="6"/>`).join("")}</g>
     <rect x="380" y="120" width="440" height="150" rx="10" fill="#241542" stroke="#ff4fa3" stroke-width="4"/>
     <path d="M560 160 L660 195 L560 230Z" fill="#ff4fa3"/>
     <g fill="#0b0616"><rect x="180" y="210" width="10" height="90"/><rect x="150" y="186" width="70" height="34" rx="6"/><circle cx="232" cy="203" r="12"/><rect x="1010" y="210" width="10" height="90"/><rect x="980" y="186" width="70" height="34" rx="6"/><circle cx="968" cy="203" r="12"/></g>
     <rect y="296" width="1200" height="34" fill="#0b0616"/>`); };
  /* Créateur stylisé : sweat à capuche, sans marque ni logo */
  ART.creator = function(o = {}){
    const g = id("cg"), c = id("cc"); const age = o.age || 20;
    return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Portrait stylisé d’un créateur de vidéos">
      <defs><radialGradient id="${g}" cx=".5" cy=".36" r=".72"><stop offset="0" stop-color="#6a3fb0"/><stop offset="1" stop-color="#1a0f33"/></radialGradient><clipPath id="${c}"><circle cx="100" cy="115" r="92"/></clipPath></defs>
      <circle cx="100" cy="115" r="98" fill="#ff4fa3"/><circle cx="100" cy="115" r="92" fill="url(#${g})"/>
      <g clip-path="url(#${c})">
        <path d="M16 240 C22 176 60 156 100 156 C140 156 178 176 184 240Z" fill="#2a2f3a"/>
        <path d="M64 170 Q100 196 136 170 Q128 152 100 152 Q72 152 64 170Z" fill="#1c2029"/>
        <path d="M92 176 v40 M108 176 v40" stroke="#e6e9ef" stroke-width="3"/>
        <rect x="88" y="130" width="24" height="30" fill="#e3b792"/>
        <ellipse cx="100" cy="106" rx="27" ry="32" fill="#eec7a2"/>
        <path d="M73 100 Q70 68 100 66 Q130 68 127 100 Q122 84 108 82 Q92 80 80 86 Q75 92 73 100Z" fill="#6b4a2c"/>
        ${age >= 22 ? `<path d="M78 120 Q100 150 122 120 Q118 140 100 142 Q82 140 78 120Z" fill="#6b4a2c" opacity=".55"/>` : ""}
        <path d="M84 102 q7 -4 13 0 M103 102 q7 -4 13 0" stroke="#4a3320" stroke-width="2.4" fill="none"/>
        <ellipse cx="91" cy="109" rx="3" ry="2.2" fill="#2f3a2c"/><ellipse cx="109" cy="109" rx="3" ry="2.2" fill="#2f3a2c"/>
        <path d="M100 109 Q97 121 101 124" stroke="#c4946a" stroke-width="2" fill="none"/>
        <path d="M88 129 Q100 139 112 129" stroke="#8f4f3c" stroke-width="2.4" fill="#fff" fill-opacity=".85"/>
      </g><circle cx="100" cy="115" r="92" fill="none" stroke="#b83a78" stroke-width="1.5"/></svg>`;
  };
  /* Décors génériques du monde magique : aucun signe distinctif, aucun personnage */
  const mstars = (n, h) => Array.from({ length: n }, (_, i) => `<circle cx="${(i * 197 + 61) % 1200}" cy="${(i * 83 + 17) % h}" r="${1 + (i % 3) * .5}" fill="#e9e4ff" opacity="${.35 + (i % 4) * .15}"/>`).join("");
  ART.scenes.chateau = function(){ return wrap(
    `<rect width="1200" height="330" fill="#12142e"/>${mstars(46, 200)}
     <circle cx="960" cy="78" r="34" fill="#f1ecd2" opacity=".9"/><circle cx="972" cy="70" r="30" fill="#12142e"/>
     <path d="M0 330 L0 250 Q200 200 420 240 L420 330Z" fill="#0b0c1c"/>
     <g fill="#070814"><rect x="470" y="170" width="260" height="160"/><rect x="430" y="120" width="46" height="210"/><path d="M424 120 L453 66 L482 120Z"/><rect x="724" y="100" width="52" height="230"/><path d="M716 100 L750 34 L784 100Z"/><rect x="560" y="130" width="70" height="60"/><path d="M552 130 L595 82 L638 130Z"/><rect x="800" y="210" width="120" height="120"/><rect x="900" y="170" width="34" height="160"/><path d="M894 170 L917 128 L940 170Z"/><path d="M300 330 Q360 250 470 250 L470 330Z"/><path d="M920 330 L920 260 Q1040 240 1200 280 L1200 330Z"/></g>
     <g fill="#f3c969" opacity=".9">${[[444, 150], [444, 200], [742, 130], [742, 180], [742, 240], [510, 200], [560, 230], [640, 210], [690, 250], [585, 150], [830, 240], [870, 270], [910, 200]].map(([x, y]) => `<rect x="${x}" y="${y}" width="7" height="12" rx="3"/>`).join("")}</g>`); };
  ART.scenes.bougies = function(){ return wrap(
    `<rect width="1200" height="330" fill="#15102a"/>${mstars(30, 150)}
     <g>${Array.from({ length: 13 }, (_, i) => { const x = 70 + i * 88, y = 60 + (i * 53) % 120; return `<circle cx="${x}" cy="${y - 14}" r="34" fill="#f3c969" opacity=".08"/><rect x="${x - 5}" y="${y}" width="10" height="${34 + (i % 3) * 10}" rx="2" fill="#efe6cf"/><path d="M${x} ${y - 20} q7 10 0 20 q-7 -10 0 -20Z" fill="#ffcf6b"/>`; }).join("")}</g>
     <rect y="262" width="1200" height="68" fill="#0b0816"/><g fill="#2a2036">${[120, 420, 720, 1020].map(x => `<rect x="${x - 110}" y="250" width="220" height="16" rx="3"/>`).join("")}</g>`); };
  ART.scenes.foret = function(){ return wrap(
    `<rect width="1200" height="330" fill="#0c1420"/>${mstars(26, 120)}
     <g fill="#0a1a16">${Array.from({ length: 16 }, (_, i) => { const x = 20 + i * 78, h = 150 + (i * 37) % 110; return `<path d="M${x} 330 L${x + 8} ${330 - h} L${x + 16} 330Z"/><path d="M${x - 34} ${330 - h * .25} L${x + 8} ${330 - h * 1.05} L${x + 50} ${330 - h * .25}Z"/><path d="M${x - 26} ${330 - h * .55} L${x + 8} ${330 - h * 1.25} L${x + 42} ${330 - h * .55}Z"/>`; }).join("")}</g>
     <rect y="300" width="1200" height="30" fill="#060d0c"/><g fill="#9fe3c8" opacity=".5">${[180, 470, 610, 930].map((x, i) => `<circle cx="${x}" cy="${250 - i * 14}" r="3"/>`).join("")}</g>`); };
  ART.scenes.parchemin = function(){ return wrap(
    `<rect width="1200" height="330" fill="#1a1426"/>
     <rect x="250" y="50" width="700" height="250" rx="6" fill="#e6d7ae" transform="rotate(-2 600 175)"/>
     <g stroke="#7a6844" stroke-width="3" opacity=".55" transform="rotate(-2 600 175)">${Array.from({ length: 7 }, (_, i) => `<path d="M310 ${95 + i * 28} h${520 - (i * 61) % 170}"/>`).join("")}</g>
     <path d="M930 40 Q1010 120 880 250 L872 244 Q990 124 922 46Z" fill="#cfc7e6"/><path d="M872 244 l-10 22 l18 -16Z" fill="#2a2036"/>
     <rect x="150" y="210" width="60" height="70" rx="8" fill="#2a2036"/><rect x="162" y="196" width="36" height="18" rx="4" fill="#3a2d4e"/>
     <rect x="1010" y="170" width="12" height="90" rx="2" fill="#efe6cf"/><path d="M1016 146 q8 12 0 24 q-8 -12 0 -24Z" fill="#ffcf6b"/><circle cx="1016" cy="156" r="40" fill="#f3c969" opacity=".08"/>`); };
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


  /* Carte interactive générique : régions, statuts et pions viennent des données du personnage */
  ART.map = function(ch, s, sel, selMarker, map){
    const m = map || ch.map; const byReg = {};
    for (const mk of m.markers(s)) (byReg[mk.region] = byReg[mk.region] || []).push(mk);
    const regs = m.regions.map(r => { const st = m.status(s, r.id); return `<polygon class="rg st-${st} ${sel === r.id ? "sel" : ""}" data-region="${r.id}" points="${r.pts}" tabindex="0" role="button" aria-label="${r.name} : ${m.statusLabel[st]}"></polygon>`; }).join("");
    const labels = m.regions.map(r => `<text class="rg-l" x="${r.c[0]}" y="${r.c[1] + (byReg[r.id] ? 24 : 4)}" text-anchor="middle">${r.short || r.name}</text>`).join("");
    const pins = Object.entries(byReg).map(([rid, arr]) => { const r = m.regions.find(x => x.id === rid); if (!r) return ""; return arr.map((mk, i) => { const x = r.c[0] + (i - (arr.length - 1) / 2) * 24, y = r.c[1] - 8; return `<g class="pin ${mk.moving ? "moving" : ""} ${selMarker === mk.id ? "sel" : ""}" data-marker="${mk.id}" tabindex="0" role="button" aria-label="${mk.title}"><title>${mk.title}</title><circle cx="${x}" cy="${y}" r="11"></circle><text x="${x}" y="${y + 4.5}" text-anchor="middle">${mk.label}</text></g>`; }).join(""); }).join("");
    return `<svg class="map-svg" viewBox="${m.viewBox}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Carte : ${m.title}">
      <rect class="sea" x="-200" y="-200" width="1600" height="1300"></rect>
      <g class="sea-lines">${Array.from({length:9},(_,i)=>`<path d="M${170+i*30} ${60+i*72} q26 -9 52 0 t52 0"/>`).join("")}</g>
      ${regs}${labels}${pins}</svg>`;
  };
  /* Illustration générique sans personnage : ciel étoilé et bougie */
  ART.plain = function(c1, c2){
    const g = id("pl");
    return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><radialGradient id="${g}" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient></defs>
      <circle cx="100" cy="115" r="94" fill="url(#${g})" stroke="rgba(255,255,255,.25)" stroke-width="2"/>
      ${Array.from({length:16},(_,i)=>`<circle cx="${30+(i*53)%140}" cy="${40+(i*37)%110}" r="${i%4?1.2:2}" fill="#fff" opacity="${i%3?.5:.9}"/>`).join("")}
      <rect x="94" y="130" width="12" height="46" rx="2" fill="#e9dfc6"/><ellipse cx="100" cy="122" rx="5" ry="9" fill="#f6c453"/><rect x="82" y="176" width="36" height="6" rx="3" fill="#8a7a55"/></svg>`;
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
