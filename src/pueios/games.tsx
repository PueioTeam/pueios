import { useState } from "react";

export { PueiMansionApp };

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
  const room = ROOMS.find(r => r.id === current)!;
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
    <div className="flex flex-col h-full text-white" style={{ background: "linear-gradient(135deg,#1a0a2a,#0a0a1a)" }}>
      <div className="flex items-center justify-between px-4 py-2 text-sm" style={{ background: "rgba(0,0,0,0.5)" }}>
        <span className="font-bold">👻 Puei Mansion</span>
        <div className="text-xs opacity-60">{solved.length} / {ROOMS.length} rooms solved</div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="w-36 border-r flex flex-col p-2 gap-1 overflow-auto" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          {ROOMS.map((r, i) => {
            const locked = i > 0 && !solved.includes(ROOMS[i - 1].id);
            return (
              <button key={r.id} onClick={() => { if (!locked) { setCurrent(r.id); setMsg(""); } }} disabled={locked}
                className="text-left rounded-lg px-2 py-2 text-xs flex items-center gap-1"
                style={{ background: current === r.id ? "rgba(255,255,255,0.15)" : "transparent", opacity: locked ? 0.3 : 1 }}>
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
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && checkSolve()}
                  className="flex-1 rounded-lg px-3 py-1.5 text-sm input-field" placeholder="Your answer..." />
                <button onClick={checkSolve} className="aero-button rounded-lg px-3 py-1.5 text-sm">Check</button>
              </div>
              {msg && <div className="text-sm">{msg}</div>}
            </div>
          )}
          {inventory.length > 0 && (
            <div className="mt-auto">
              <div className="text-xs opacity-50 mb-1">Collected:</div>
              <div className="flex flex-col gap-0.5">{inventory.map((it, i) => <div key={i} className="text-xs opacity-70">{it}</div>)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
