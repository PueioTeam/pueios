import { useEffect, useRef, useState } from "react";

export { PueiRacingApp, PueiQuestApp, PueiKingdomApp, PueiGalaxyApp, PueiMansionApp, PueiCraftApp, PueiSurvivalApp };

// ---------- Puei Racing ----------
const RACING_CHARS_DATA = [
  { name: "Puei", color: "#4fa8e0", emoji: "🏎️" },
  { name: "Blaze", color: "#e04f4f", emoji: "🚗" },
  { name: "Storm", color: "#a04fe0", emoji: "🚙" },
];
const TRACK_TILES = 20;
const RACE_LAPS = 3;
const RACE_ITEMS = ["⚡ Speed boost!", "🛡️ Shield!", "🍌 Banana peel!", "🎯 Missile!"];
function PueiRacingApp() {
  const [started, setStarted] = useState(false);
  const [charIdx, setCharIdx] = useState(0);
  const [positions, setPositions] = useState([0, 0, 0]);
  const [lap, setLap] = useState([0, 0, 0]);
  const [finished, setFinished] = useState<number | null>(null);
  const [item, setItem] = useState("");
  const tickRef = useRef<number | null>(null);

  const start = () => {
    setPositions([0,0,0]); setLap([0,0,0]); setFinished(null); setItem(""); setStarted(true);
  };

  useEffect(() => {
    if (!started || finished !== null) return;
    tickRef.current = window.setInterval(() => {
      setPositions(prev => {
        return prev.map((p, i) => {
          if (i === charIdx) return p;
          const next = p + (Math.random() < 0.6 ? 1 : 0);
          if (next >= TRACK_TILES) {
            setLap(l => {
              const nl = [...l];
              nl[i]++;
              if (nl[i] >= RACE_LAPS && finished === null) {
                setFinished(i);
                if (tickRef.current) clearInterval(tickRef.current);
              }
              return nl;
            });
            return 0;
          }
          return next;
        });
      });
    }, 700);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [started, charIdx]);

  const move = () => {
    if (!started || finished !== null) return;
    setPositions(prev => {
      const next = [...prev];
      next[charIdx] = prev[charIdx] + 2 + Math.floor(Math.random() * 2);
      if (next[charIdx] >= TRACK_TILES) {
        next[charIdx] = 0;
        setLap(l => {
          const nl = [...l];
          nl[charIdx]++;
          if (nl[charIdx] >= RACE_LAPS && finished === null) {
            setFinished(charIdx);
            if (tickRef.current) clearInterval(tickRef.current);
          }
          return nl;
        });
      }
      return next;
    });
    if (Math.random() < 0.25) {
      const it = RACE_ITEMS[Math.floor(Math.random() * RACE_ITEMS.length)];
      setItem(it);
      setTimeout(() => setItem(""), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4" style={{ background: "linear-gradient(135deg, #0a2040, #0d3060)" }}>
      <div className="text-center">
        <span className="text-2xl font-bold text-white">🎮 Puei Racing</span>
        <div className="text-xs text-white/50 mt-1">First to {RACE_LAPS} laps wins! Tap GO to accelerate.</div>
      </div>
      {!started ? (
        <div className="flex flex-col items-center gap-4 mt-4">
          <div className="text-white font-semibold">Choose your character:</div>
          <div className="flex gap-3">
            {RACING_CHARS_DATA.map((c, i) => (
              <button key={i} onClick={() => setCharIdx(i)}
                className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 transition-all"
                style={{ borderColor: charIdx===i ? c.color : "transparent", background: charIdx===i ? c.color+"33" : "rgba(255,255,255,0.08)", color:"#fff" }}>
                <span className="text-3xl">{c.emoji}</span>
                <span className="text-sm font-semibold">{c.name}</span>
              </button>
            ))}
          </div>
          <button onClick={start} className="aero-button rounded-xl px-8 py-2 font-bold text-sm mt-2">🚦 Start Race!</button>
        </div>
      ) : finished !== null ? (
        <div className="flex flex-col items-center gap-3 mt-8">
          <div className="text-4xl">{finished === charIdx ? "🏆" : "💨"}</div>
          <div className="text-white text-xl font-bold">{finished === charIdx ? "You won!" : RACING_CHARS_DATA[finished].name + " won!"}</div>
          <div className="text-white/60 text-sm">Race complete — {RACE_LAPS} laps</div>
          <button onClick={start} className="aero-button rounded-xl px-6 py-2 text-sm mt-2">🔄 Race Again</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {RACING_CHARS_DATA.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-lg w-6">{c.emoji}</span>
              <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.1)" }}>
                <div className="h-full rounded-full transition-all duration-200 flex items-center justify-end pr-1"
                  style={{ width:`${Math.max(4,(positions[i]/TRACK_TILES)*100)}%`, background:c.color }}>
                  {i===charIdx && <span className="text-[9px] text-white font-bold">YOU</span>}
                </div>
              </div>
              <span className="text-white/60 text-xs w-14">Lap {(lap[i]||0)+1}/{RACE_LAPS}</span>
            </div>
          ))}
          {item && <div className="text-center text-yellow-300 text-sm font-semibold">{item}</div>}
          <div className="flex justify-center mt-3">
            <button onClick={move}
              className="rounded-full text-white font-bold text-xl px-12 py-5"
              style={{ background:RACING_CHARS_DATA[charIdx].color, boxShadow:`0 0 24px ${RACING_CHARS_DATA[charIdx].color}` }}>
              ⚡ GO!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Puei Quest ----------
type QuestEnemy = { name:string; emoji:string; hp:number; maxHp:number; atk:number };
const QUEST_ZONES_DATA = [
  { name:"🌴 Puei Island",  bg:"linear-gradient(135deg,#1a4a2a,#2a6040)", enemies:[{name:"Slime",emoji:"🟢",maxHp:20,atk:4},{name:"Crab",emoji:"🦀",maxHp:30,atk:6}] },
  { name:"🌊 Shore Cave",   bg:"linear-gradient(135deg,#1a2a4a,#2a3a60)", enemies:[{name:"Bat",emoji:"🦇",maxHp:25,atk:8},{name:"Skeleton",emoji:"💀",maxHp:40,atk:10}] },
  { name:"🏙️ Puei City",   bg:"linear-gradient(135deg,#2a1a4a,#3a2a60)", enemies:[{name:"Thug",emoji:"😈",maxHp:50,atk:12},{name:"Boss",emoji:"👾",maxHp:80,atk:18}] },
];
function PueiQuestApp() {
  const [hp, setHp] = useState(100);
  const [maxHp, setMaxHp] = useState(100);
  const [atk, setAtk] = useState(15);
  const [def, setDef] = useState(3);
  const [xp, setXp] = useState(0);
  const [lvl, setLvl] = useState(1);
  const [gold, setGold] = useState(10);
  const [zoneIdx, setZoneIdx] = useState(0);
  const [enemy, setEnemy] = useState<QuestEnemy | null>(null);
  const [log, setLog] = useState<string[]>(["Welcome to Puei Quest! Explore the world."]);
  const [screen, setScreen] = useState<"map" | "battle" | "dead">("map");
  const addLog = (s:string) => setLog(l => [s,...l].slice(0,8));
  const zone = QUEST_ZONES_DATA[zoneIdx];
  const spawnEnemy = () => {
    const tmpl = zone.enemies[Math.floor(Math.random()*zone.enemies.length)];
    setEnemy({...tmpl, hp:tmpl.maxHp}); setScreen("battle");
    addLog(`A wild ${tmpl.emoji} ${tmpl.name} appeared!`);
  };
  const attack = () => {
    if (!enemy) return;
    const dmg = Math.max(1, atk - Math.floor(Math.random()*4));
    const eDmg = Math.max(1, enemy.atk - def + Math.floor(Math.random()*3));
    const newEHp = enemy.hp - dmg;
    addLog(`You hit ${enemy.name} for ${dmg}. It hits back for ${eDmg}.`);
    if (newEHp <= 0) {
      const earned = Math.floor(enemy.maxHp/2);
      const xpEarned = enemy.maxHp;
      setGold(g => g+earned);
      setXp(x => {
        const nx = x+xpEarned;
        if (nx >= lvl*50) {
          setLvl(l => l+1); setMaxHp(m => m+20); setHp(h => Math.min(h+20,maxHp+20));
          setAtk(a => a+3); setDef(d => d+1); addLog("🌟 Level up!");
        }
        return nx;
      });
      addLog(`✨ ${enemy.name} defeated! +${earned}g +${xpEarned}XP`);
      setEnemy(null); setScreen("map");
    } else {
      setEnemy(e => e ? {...e, hp:newEHp} : null);
      setHp(h => { const n = h-eDmg; if(n<=0){setScreen("dead");return 0;} return n; });
    }
  };
  const heal = () => { if(gold<5)return; setGold(g=>g-5); setHp(h=>Math.min(h+30,maxHp)); addLog("💊 Healed 30 HP for 5 gold."); };
  return (
    <div className="flex flex-col h-full text-white text-sm" style={{ background:zone.bg }}>
      <div className="flex items-center justify-between px-4 py-2 text-xs" style={{ background:"rgba(0,0,0,0.4)" }}>
        <span className="font-bold">⚔️ Puei Quest</span>
        <div className="flex gap-3">
          <span>❤️ {hp}/{maxHp}</span><span>⚔️ {atk}</span><span>🛡️ {def}</span><span>Lv.{lvl}</span><span>💰 {gold}</span>
        </div>
      </div>
      {screen==="dead" ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="text-5xl">💀</div><div className="text-xl font-bold">You died...</div>
          <button className="aero-button rounded-xl px-6 py-2" onClick={() => {
            setHp(100);setMaxHp(100);setAtk(15);setDef(3);setXp(0);setLvl(1);setGold(10);setZoneIdx(0);setEnemy(null);setLog(["Respawned!"]);setScreen("map");
          }}>🔄 Respawn</button>
        </div>
      ) : screen==="battle" && enemy ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <div className="text-6xl">{enemy.emoji}</div>
          <div className="font-bold">{enemy.name}</div>
          <div className="w-48 h-3 rounded-full bg-black/40 overflow-hidden">
            <div className="h-full bg-red-500 transition-all" style={{width:`${(enemy.hp/enemy.maxHp)*100}%`}}/>
          </div>
          <div className="text-xs opacity-60">{enemy.hp}/{enemy.maxHp} HP</div>
          <div className="flex gap-3">
            <button onClick={attack} className="aero-button rounded-xl px-6 py-2 font-bold">⚔️ Attack</button>
            <button onClick={() => {setScreen("map");setEnemy(null);addLog("You fled!");}} className="aero-button rounded-xl px-4 py-2">🏃 Flee</button>
          </div>
          <div className="w-full max-w-xs mt-1 space-y-0.5">
            {log.slice(0,4).map((l,i) => <div key={i} className="text-xs opacity-60">{l}</div>)}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-3 p-4">
          <div className="font-bold">{zone.name}</div>
          <div className="flex gap-2 flex-wrap">
            {QUEST_ZONES_DATA.map((z,i) => (
              <button key={i} onClick={() => {setZoneIdx(i);addLog(`Traveled to ${z.name}`);}} disabled={i>Math.floor(lvl/2)}
                className="aero-button rounded-lg px-3 py-1 text-xs" style={{opacity:i>Math.floor(lvl/2)?0.4:1}}>{z.name}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={spawnEnemy} className="aero-button rounded-xl px-4 py-2 text-sm font-bold">⚔️ Fight enemy</button>
            <button onClick={heal} disabled={gold<5} className="aero-button rounded-xl px-4 py-2 text-sm" style={{opacity:gold<5?0.5:1}}>💊 Heal (5g)</button>
          </div>
          <div className="w-full bg-black/30 rounded-full h-2">
            <div className="h-2 rounded-full bg-yellow-400 transition-all" style={{width:`${Math.min(100,(xp/(lvl*50))*100)}%`}}/>
          </div>
          <div className="text-xs opacity-50">XP: {xp}/{lvl*50}</div>
          <div className="space-y-0.5">{log.map((l,i) => <div key={i} className="text-xs opacity-60">{l}</div>)}</div>
        </div>
      )}
    </div>
  );
}

// ---------- Puei Kingdom ----------
function PueiKingdomApp() {
  const BUILDINGS = [
    { id:"farm",   name:"Farm",   emoji:"🌾", baseCost:10,  perTick:2  },
    { id:"mine",   name:"Mine",   emoji:"⛏️", baseCost:50,  perTick:8  },
    { id:"market", name:"Market", emoji:"🏪", baseCost:150, perTick:20 },
    { id:"castle", name:"Castle", emoji:"🏰", baseCost:500, perTick:60 },
  ];
  const [gold, setGold] = useState(20);
  const [pop, setPop] = useState(5);
  const [counts, setCounts] = useState<Record<string,number>>({farm:0,mine:0,market:0,castle:0});
  const [costs, setCosts] = useState<Record<string,number>>({farm:10,mine:50,market:150,castle:500});
  const [wave, setWave] = useState(1);
  const [defense, setDefense] = useState(10);
  const [log, setLog] = useState<string[]>(["Your kingdom begins. Build and grow!"]);
  const addLog = (s:string) => setLog(l => [s,...l].slice(0,6));
  const income = BUILDINGS.reduce((s,b) => s + b.perTick*(counts[b.id]||0), 1);
  useEffect(() => {
    const t = setInterval(() => { setGold(g => g+income); setPop(p => p+Math.floor(income/10)); }, 2000);
    return () => clearInterval(t);
  }, [income]);
  useEffect(() => {
    const t = setInterval(() => {
      const strength = wave*15;
      if (defense >= strength) {
        setGold(g => g+wave*20); addLog(`⚔️ Wave ${wave} repelled! +${wave*20}g`);
      } else {
        setGold(g => Math.max(0, g-(strength-defense)*2)); addLog(`💥 Wave ${wave} broke through!`);
      }
      setWave(w => w+1);
    }, 12000);
    return () => clearInterval(t);
  }, [defense, wave]);
  const buy = (id:string) => {
    const b = BUILDINGS.find(x => x.id===id)!;
    const cost = costs[id] || b.baseCost;
    if (gold < cost) return;
    setGold(g => g-cost);
    setCounts(c => ({...c,[id]:(c[id]||0)+1}));
    setCosts(c => ({...c,[id]:Math.floor(cost*1.4)}));
    addLog(`Built a ${b.emoji} ${b.name}!`);
  };
  return (
    <div className="flex flex-col h-full text-white" style={{background:"linear-gradient(135deg,#1a3a1a,#2a5a2a)"}}>
      <div className="flex items-center justify-between px-4 py-2 text-sm" style={{background:"rgba(0,0,0,0.4)"}}>
        <span className="font-bold">🏰 Puei Kingdom</span>
        <div className="flex gap-3 text-xs"><span>💰 {gold}</span><span>👥 {pop}</span><span>🛡️ {defense}</span><span>⚔️ Wave {wave}</span></div>
      </div>
      <div className="flex-1 p-4 flex flex-col gap-3 overflow-auto">
        <div className="text-xs opacity-60">Income: +{income}/tick · Enemy wave every ~12s</div>
        <div className="grid grid-cols-2 gap-2">
          {BUILDINGS.map(b => (
            <button key={b.id} onClick={() => buy(b.id)}
              className="aero-button rounded-xl p-3 text-left flex items-center gap-2"
              style={{opacity:gold<(costs[b.id]||b.baseCost)?0.5:1}}>
              <span className="text-2xl">{b.emoji}</span>
              <div>
                <div className="text-xs font-semibold">{b.name} ({counts[b.id]||0})</div>
                <div className="text-[10px] opacity-60">+{b.perTick}/tick · 💰{costs[b.id]||b.baseCost}</div>
              </div>
            </button>
          ))}
          <button onClick={() => { if(gold<30)return; setGold(g=>g-30); setDefense(d=>d+8); addLog("🧱 Wall! +8 def"); }}
            className="aero-button rounded-xl p-3 text-left flex items-center gap-2" style={{opacity:gold<30?0.5:1}}>
            <span className="text-2xl">🧱</span>
            <div><div className="text-xs font-semibold">Wall</div><div className="text-[10px] opacity-60">+8 def · 💰30</div></div>
          </button>
        </div>
        <div className="space-y-1">{log.map((l,i) => <div key={i} className="text-xs opacity-60">{l}</div>)}</div>
      </div>
    </div>
  );
}

// ---------- Puei Galaxy ----------
function PueiGalaxyApp() {
  const PLANETS_DATA = [
    { name:"Pueia Prime",    emoji:"🌍", dist:0,  reward:0,   desc:"Your home planet.",              found:true  },
    { name:"Blaze Rock",     emoji:"🪨", dist:20, reward:40,  desc:"Scorching asteroid belt.",       found:false },
    { name:"Crystal Moon",   emoji:"🌙", dist:35, reward:70,  desc:"Crystal caves full of ore.",     found:false },
    { name:"Nebula Station", emoji:"🌌", dist:55, reward:120, desc:"Ancient Pueian space station.",  found:false },
    { name:"The Void",       emoji:"🌑", dist:80, reward:200, desc:"A mysterious dark planet...",    found:false },
  ];
  const [fuel, setFuel] = useState(100);
  const [credits, setCredits] = useState(50);
  const [shipLvl, setShipLvl] = useState(1);
  const [planets, setPlanets] = useState(PLANETS_DATA);
  const [location, setLocation] = useState(0);
  const [log, setLog] = useState(["Ready for launch, Captain."]);
  const addLog = (s:string) => setLog(l => [s,...l].slice(0,7));
  const travelTo = (i:number) => {
    const cost = Math.max(1, Math.ceil(Math.abs(planets[i].dist-planets[location].dist)/shipLvl));
    if (cost > fuel) { addLog("Not enough fuel!"); return; }
    setFuel(f => f-cost); setLocation(i);
    if (!planets[i].found) {
      setPlanets(ps => ps.map((p,j) => j===i ? {...p,found:true} : p));
      setCredits(c => c+planets[i].reward);
      addLog(`Discovered ${planets[i].emoji} ${planets[i].name}! +${planets[i].reward}`);
    } else {
      addLog(`Arrived at ${planets[i].emoji} ${planets[i].name}.`);
    }
  };
  return (
    <div className="flex flex-col h-full text-white" style={{background:"linear-gradient(135deg,#000010,#0a0a40)"}}>
      <div className="flex items-center justify-between px-4 py-2 text-sm" style={{background:"rgba(0,0,0,0.6)"}}>
        <span className="font-bold">🚀 Puei Galaxy</span>
        <div className="flex gap-3 text-xs"><span>⛽ {fuel}%</span><span>💳 {credits}</span><span>🚀 Lv.{shipLvl}</span></div>
      </div>
      <div className="flex-1 p-4 flex flex-col gap-3 overflow-auto">
        <div className="font-semibold">{planets[location].emoji} {planets[location].name}</div>
        <div className="text-xs opacity-60">{planets[location].desc}</div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { const e=Math.floor(Math.random()*20+10)*shipLvl; setCredits(c=>c+e); setFuel(f=>Math.max(0,f-5)); addLog(`Mined +${e}`); }}
            className="aero-button rounded-lg px-3 py-1.5 text-xs">Mine (-5 fuel)</button>
          <button onClick={() => { if(credits<20)return; setCredits(c=>c-20); setFuel(100); addLog("Refueled!"); }}
            disabled={credits<20} className="aero-button rounded-lg px-3 py-1.5 text-xs" style={{opacity:credits<20?0.5:1}}>Refuel (-20)</button>
          <button onClick={() => { const cost=shipLvl*80; if(credits<cost)return; setCredits(c=>c-cost); setShipLvl(l=>l+1); addLog(`Ship Lv.${shipLvl+1}!`); }}
            disabled={credits<shipLvl*80} className="aero-button rounded-lg px-3 py-1.5 text-xs" style={{opacity:credits<shipLvl*80?0.5:1}}>Upgrade (-{shipLvl*80})</button>
        </div>
        <div className="font-semibold text-sm mt-1">Star Map</div>
        {planets.map((p,i) => {
          const cost = Math.max(1, Math.ceil(Math.abs(p.dist-planets[location].dist)/shipLvl));
          return (
            <button key={i} onClick={() => travelTo(i)} disabled={i===location}
              className="w-full aero-button rounded-lg p-2 text-left flex items-center gap-3 text-xs"
              style={{opacity:i===location?0.4:1}}>
              <span className="text-2xl">{p.emoji}</span>
              <div className="flex-1">
                <div className="font-semibold">{p.found ? p.name : "???"} {!p.found && "❓"}</div>
                <div className="opacity-60">{p.found ? p.desc : "Unexplored"} · fuel: {cost}</div>
              </div>
              {i===location && <span className="text-[10px] opacity-60">HERE</span>}
            </button>
          );
        })}
        <div className="space-y-0.5">{log.map((l,i) => <div key={i} className="text-xs opacity-50">{l}</div>)}</div>
      </div>
    </div>
  );
}

// ---------- Puei Mansion ----------
function PueiMansionApp() {
  const ROOMS = [
    { id:"hall",    name:"Haunted Hall",   emoji:"🏚️", desc:"A note on the floor says: 4 + 1 = ?",       answer:"5",     secret:"Found: a rusty key!" },
    { id:"lib",     name:"Creepy Library", emoji:"📚", desc:"What has hands but cannot clap?",            answer:"clock", secret:"Found: a glowing orb!" },
    { id:"kitchen", name:"Ghost Kitchen",  emoji:"🍳", desc:"I am hot but I am not fire. What am I?",     answer:"sun",   secret:"Found: a strange potion!" },
    { id:"attic",   name:"Spooky Attic",   emoji:"🕷️", desc:"3 times 3 plus 1 equals what?",             answer:"10",    secret:"Found: a golden crown!" },
    { id:"vault",   name:"Secret Vault",   emoji:"🔐", desc:"Enter the password to claim the mansion.",   answer:"puei",  secret:"You mastered Puei Mansion! You win!" },
  ];
  const [solved, setSolved] = useState<string[]>([]);
  const [current, setCurrent] = useState("hall");
  const [input, setInput] = useState("");
  const [msg, setMsg] = useState("");
  const [inventory, setInventory] = useState<string[]>([]);
  const room = ROOMS.find(r => r.id===current)!;
  const isSolved = solved.includes(current);
  const checkSolve = () => {
    if (input.trim().toLowerCase() === room.answer) {
      setSolved(s => [...s, room.id]);
      setInventory(inv => [...inv, room.secret]);
      setMsg(room.secret);
    } else {
      setMsg("Wrong answer, try again!");
    }
    setInput("");
  };
  return (
    <div className="flex flex-col h-full text-white" style={{background:"linear-gradient(135deg,#1a0a2a,#0a0a1a)"}}>
      <div className="flex items-center justify-between px-4 py-2 text-sm" style={{background:"rgba(0,0,0,0.5)"}}>
        <span className="font-bold">👻 Puei Mansion</span>
        <div className="text-xs opacity-60">{solved.length} / {ROOMS.length} rooms solved</div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="w-36 border-r flex flex-col p-2 gap-1 overflow-auto" style={{borderColor:"rgba(255,255,255,0.1)"}}>
          {ROOMS.map((r,i) => {
            const locked = i>0 && !solved.includes(ROOMS[i-1].id);
            return (
              <button key={r.id} onClick={() => { if(!locked){setCurrent(r.id);setMsg("");} }} disabled={locked}
                className="text-left rounded-lg px-2 py-2 text-xs flex items-center gap-1"
                style={{background:current===r.id?"rgba(255,255,255,0.15)":"transparent",opacity:locked?0.3:1}}>
                <span>{r.emoji}</span><span className="truncate">{r.name}</span>
                {solved.includes(r.id) && <span className="ml-auto">✅</span>}
              </button>
            );
          })}
        </div>
        <div className="flex-1 flex flex-col p-4 gap-3">
          <div className="text-xl font-bold">{room.emoji} {room.name}</div>
          <div className="text-sm opacity-70">{room.desc}</div>
          {isSolved ? (
            <div className="text-green-400 font-semibold text-sm">{room.secret}</div>
          ) : (
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex gap-2">
                <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&checkSolve()}
                  className="flex-1 rounded-lg px-3 py-1.5 text-sm input-field" placeholder="Your answer..."/>
                <button onClick={checkSolve} className="aero-button rounded-lg px-3 py-1.5 text-sm">Check</button>
              </div>
              {msg && <div className="text-sm">{msg}</div>}
            </div>
          )}
          {inventory.length > 0 && (
            <div className="mt-auto">
              <div className="text-xs opacity-50 mb-1">Collected:</div>
              <div className="flex flex-col gap-0.5">{inventory.map((it,i) => <div key={i} className="text-xs opacity-70">{it}</div>)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- PueiCraft ----------
const PCRAFT_W = 42, PCRAFT_H = 26;
const PCRAFT_COLORS: Record<string,string> = {
  air:"transparent", grass:"#4a9e3a", dirt:"#8b5e3c", stone:"#777",
  water:"#3a7fc1", wood:"#7a5c2a", leaf:"#2d8a2d", sand:"#e0c878"
};
type PCraftCell = { t: string };
function PueiCraftApp() {
  const makeGrid = () => Array.from({length:PCRAFT_H}, (_,y) =>
    Array.from({length:PCRAFT_W}, () => {
      if (y < 7) return { t:"air" } as PCraftCell;
      if (y === 7) return { t:"grass" } as PCraftCell;
      if (y < 11) return { t:"dirt" } as PCraftCell;
      return { t:"stone" } as PCraftCell;
    })
  );
  const [grid, setGrid] = useState<PCraftCell[][]>(makeGrid);
  const [sel, setSel] = useState("dirt");
  const [erase, setErase] = useState(false);
  const [painting, setPainting] = useState(false);
  const BLOCKS = ["grass","dirt","stone","water","wood","leaf","sand"];
  const paint = (y:number, x:number) => setGrid(g => g.map((row,ry) => row.map((cell,cx) => ry===y&&cx===x ? {t:erase?"air":sel} : cell)));
  return (
    <div className="flex flex-col h-full" style={{background:"#5ba3d6"}}>
      <div className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0 flex-wrap text-white" style={{background:"rgba(0,0,0,0.45)"}}>
        <span className="font-bold text-sm">🧱 PueiCraft</span>
        {BLOCKS.map(b => (
          <button key={b} onClick={() => {setSel(b);setErase(false);}} title={b}
            className="w-7 h-7 rounded border-2 text-xs flex items-center justify-center font-bold"
            style={{background:PCRAFT_COLORS[b],borderColor:sel===b&&!erase?"white":"rgba(255,255,255,0.2)"}}>
          </button>
        ))}
        <span className="text-xs opacity-50">{sel}</span>
        <button onClick={() => setErase(e=>!e)} className="rounded border-2 px-2 py-0.5 text-xs"
          style={{borderColor:erase?"white":"transparent",background:"rgba(255,80,80,0.4)"}}>Remove</button>
        <button onClick={() => setGrid(makeGrid())} className="ml-auto aero-button rounded px-2 py-0.5 text-xs">Reset</button>
      </div>
      <div className="flex-1 overflow-auto select-none" onMouseLeave={()=>setPainting(false)} onMouseUp={()=>setPainting(false)}>
        <div style={{display:"grid",gridTemplateColumns:`repeat(${PCRAFT_W},16px)`,width:PCRAFT_W*16}}>
          {grid.map((row,y) => row.map((cell,x) => (
            <div key={`${y}-${x}`}
              style={{width:16,height:16,background:PCRAFT_COLORS[cell.t]||"transparent",border:"0.5px solid rgba(0,0,0,0.07)",cursor:"crosshair"}}
              onMouseDown={() => {setPainting(true);paint(y,x);}}
              onMouseEnter={() => {if(painting)paint(y,x);}}
            />
          )))}
        </div>
      </div>
    </div>
  );
}

// ---------- Puei Survival ----------
function PueiSurvivalApp() {
  const BIOMES = ["🌲 Forest","🏔️ Mountains","🏜️ Desert","🌊 Coast","❄️ Tundra"];
  const RES_DATA: Record<string,{emoji:string;gain:number}> = {
    wood:  {emoji:"🪵",gain:3},
    stone: {emoji:"🪨",gain:2},
    food:  {emoji:"🍖",gain:2},
    water: {emoji:"💧",gain:2},
  };
  const CRAFTS_DATA = [
    { name:"Campfire",  emoji:"🔥", cost:{wood:3},          desc:"Warmth and light." },
    { name:"Shelter",   emoji:"🛖", cost:{wood:8,stone:4},  desc:"Protects from storms." },
    { name:"Spear",     emoji:"🗡️", cost:{wood:2,stone:2},  desc:"+5 attack vs monsters." },
    { name:"Raft",      emoji:"⛵", cost:{wood:12},          desc:"Cross rivers and coasts." },
  ];
  const [inv, setInv] = useState<Record<string,number>>({wood:0,stone:0,food:0,water:0});
  const [hp, setHp] = useState(100);
  const [day, setDay] = useState(1);
  const [crafted, setCrafted] = useState<string[]>([]);
  const [biome, setBiome] = useState(0);
  const [log, setLog] = useState(["You wake up on a strange island. Survive!"]);
  const addLog = (s:string) => setLog(l => [s,...l].slice(0,8));
  const gather = (res:string) => {
    const r = RES_DATA[res];
    const amt = r.gain + Math.floor(Math.random()*3);
    setInv(i => ({...i,[res]:(i[res]||0)+amt}));
    setHp(h => Math.max(10, h-2));
    addLog(`Gathered ${amt} ${res} ${r.emoji}`);
  };
  const craft = (c:typeof CRAFTS_DATA[0]) => {
    for (const [k,v] of Object.entries(c.cost)) if ((inv[k]||0)<v) { addLog("Not enough resources!"); return; }
    setInv(i => { const n={...i}; for(const [k,v] of Object.entries(c.cost)) n[k]=(n[k]||0)-v; return n; });
    setCrafted(cc => [...cc, c.name]);
    addLog(`Crafted ${c.emoji} ${c.name}! ${c.desc}`);
  };
  const rest = () => { setHp(h=>Math.min(100,h+20)); setDay(d=>d+1); addLog(`Rested. Day ${day+1}.`); };
  const explore = () => {
    const events = [
      "Found supplies! +3 food, +2 water",
      "Attacked by monster! -15 HP",
      "Found stone deposits! +4 stone",
      "Caught in storm! -10 HP",
      "Discovered a spring! +5 water",
    ];
    const e = events[Math.floor(Math.random()*events.length)];
    if (e.includes("monster")) setHp(h=>Math.max(0,h-15));
    if (e.includes("storm"))   setHp(h=>Math.max(0,h-10));
    if (e.includes("supplies")) setInv(i=>({...i,food:(i.food||0)+3,water:(i.water||0)+2}));
    if (e.includes("stone"))   setInv(i=>({...i,stone:(i.stone||0)+4}));
    if (e.includes("spring"))  setInv(i=>({...i,water:(i.water||0)+5}));
    setBiome(b=>(b+1)%BIOMES.length);
    addLog(e);
  };
  return (
    <div className="flex flex-col h-full text-white" style={{background:"linear-gradient(135deg,#1a3a1a,#0a2a1a)"}}>
      <div className="flex items-center justify-between px-4 py-2 text-sm" style={{background:"rgba(0,0,0,0.5)"}}>
        <span className="font-bold">🌊 Puei Survival</span>
        <div className="flex gap-3 text-xs"><span>❤️ {hp}</span><span>Day {day}</span><span>{BIOMES[biome]}</span></div>
      </div>
      <div className="w-full h-2 bg-red-900/50"><div className="h-2 bg-red-500 transition-all" style={{width:`${hp}%`}}/></div>
      {hp <= 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="text-5xl">💀</div>
          <div className="text-xl font-bold">You did not survive...</div>
          <div className="text-sm opacity-60">Made it to Day {day}</div>
          <button onClick={()=>{setInv({wood:0,stone:0,food:0,water:0});setHp(100);setDay(1);setCrafted([]);setBiome(0);setLog(["You try again!"]);}}
            className="aero-button rounded-xl px-6 py-2">Try Again</button>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 p-3 flex flex-col gap-3 overflow-auto">
            <div className="grid grid-cols-2 gap-1 text-xs">
              {Object.entries(inv).map(([k,v]) => (
                <div key={k} className="flex items-center justify-between rounded-lg px-2 py-1" style={{background:"rgba(255,255,255,0.08)"}}>
                  <span>{RES_DATA[k].emoji} {k}</span><span className="font-bold">{v}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {Object.keys(RES_DATA).map(res => (
                <button key={res} onClick={()=>gather(res)} className="aero-button rounded-lg px-2 py-2 text-xs flex items-center gap-1">
                  <span>{RES_DATA[res].emoji}</span><span>Gather {res}</span>
                </button>
              ))}
              <button onClick={explore} className="aero-button rounded-lg px-2 py-2 text-xs">Explore</button>
              <button onClick={rest} className="aero-button rounded-lg px-2 py-2 text-xs">Rest (+20 HP)</button>
            </div>
            <div className="text-xs opacity-60 font-semibold">Crafting</div>
            <div className="grid grid-cols-2 gap-1">
              {CRAFTS_DATA.map(c => {
                const can = Object.entries(c.cost).every(([k,v]) => (inv[k]||0)>=v);
                const done = crafted.includes(c.name);
                return (
                  <button key={c.name} onClick={()=>craft(c)} disabled={!can||done}
                    className="aero-button rounded-lg p-2 text-left text-xs" style={{opacity:can&&!done?1:0.4}}>
                    <div className="font-semibold">{c.emoji} {c.name} {done?"(done)":""}</div>
                    <div className="opacity-60">{Object.entries(c.cost).map(([k,v])=>`${v} ${k}`).join(", ")}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="w-40 border-l p-2 flex flex-col gap-0.5 overflow-auto" style={{borderColor:"rgba(255,255,255,0.1)"}}>
            <div className="text-xs opacity-50 font-semibold mb-1">Log</div>
            {log.map((l,i) => <div key={i} className="text-[10px] opacity-60 leading-tight">{l}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
