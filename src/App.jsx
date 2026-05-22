import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

// ── Couleurs / labels de génération ─────────────────────────────────────────
const GEN_COLORS = [
  "#e53935", "#fb8c00", "#43a047", "#1e88e5",
  "#8e24aa", "#00acc1", "#f4511e", "#6d4c41", "#c62828",
];
const GEN_REGIONS = [
  "Kanto", "Johto", "Hoenn", "Sinnoh",
  "Unova", "Kalos", "Alola", "Galar", "Paldea",
];
const getGenColor = (i) => GEN_COLORS[i] ?? "#555";
const getGenLabel = (i, name) => {
  const num = ["I","II","III","IV","V","VI","VII","VIII","IX","X"][i] ?? `${i+1}`;
  const region = GEN_REGIONS[i] ?? name;
  return `Génération ${num} — ${region}`;
};

const FALLBACK_SPRITE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png";

const PokemonImg = ({ src, id, alt, style }) => (
  <img
    src={src || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`}
    alt={alt}
    style={style}
    onError={e => { e.target.onerror = null; e.target.src = FALLBACK_SPRITE; }}
  />
);

const GenderBadge = ({ hasDimorphism }) => {
  if (!hasDimorphism) return null;
  return (
    <span title="Dimorphisme sexuel" style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      backgroundColor: "#f48fb1", color: "#4a0030",
      borderRadius: 4, padding: "1px 5px", fontSize: "10px",
      fontWeight: "bold", marginTop: 4,
    }}>♀≠♂</span>
  );
};

// ── Écran de connexion ───────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      // onAuthStateChanged dans App se chargera du reste
    } catch (e) {
      const messages = {
        "auth/email-already-in-use": "Cet email est déjà utilisé.",
        "auth/invalid-email": "Email invalide.",
        "auth/weak-password": "Mot de passe trop court (6 caractères min).",
        "auth/user-not-found": "Aucun compte avec cet email.",
        "auth/wrong-password": "Mot de passe incorrect.",
        "auth/invalid-credential": "Email ou mot de passe incorrect.",
      };
      setError(messages[e.code] || e.message);
    }
    setLoading(false);
  };

  const inputStyle = {
    padding: 10, fontSize: 15, borderRadius: 6,
    border: '1px solid #ccc', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#f5f5f5', fontFamily: 'sans-serif',
    }}>
      <div style={{
        backgroundColor: 'white', padding: 40, borderRadius: 12,
        boxShadow: '0 2px 16px rgba(0,0,0,0.12)', width: 340,
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: 24 }}>
          {mode === "login" ? "Connexion" : "Créer un compte"}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handle()}
            style={inputStyle}
          />

          {error && <p style={{ color: '#e53935', fontSize: 13, margin: 0 }}>{error}</p>}

          <button
            onClick={handle}
            disabled={loading}
            style={{
              padding: 12, backgroundColor: '#e53935', color: 'white',
              border: 'none', borderRadius: 6, fontSize: 15,
              cursor: loading ? 'default' : 'pointer', fontWeight: 'bold',
            }}>
            {loading ? "..." : mode === "login" ? "Se connecter" : "Créer le compte"}
          </button>

          <p style={{ textAlign: 'center', fontSize: 13, color: '#666', margin: 0 }}>
            {mode === "login" ? "Pas encore de compte ? " : "Déjà un compte ? "}
            <span
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              style={{ color: '#e53935', cursor: 'pointer', textDecoration: 'underline' }}>
              {mode === "login" ? "Créer un compte" : "Se connecter"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── App principale ───────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(undefined); // undefined = chargement auth en cours

  const [allForms, setAllForms] = useState([]);
  const [generations, setGenerations] = useState([]);
  const [sexualDimorphism, setSexualDimorphism] = useState(new Set());
  const [multiWordBase, setMultiWordBase] = useState(new Set());

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState("Démarrage...");
  const [filterType, setFilterType] = useState("all");
  const [expanded, setExpanded] = useState(new Set());
  const [caught, setCaught] = useState([]);
  const [savePending, setSavePending] = useState(false);

  // ── Auth listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Charger les captures depuis Firestore
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          setCaught(snap.data().caught || []);
        }
      } else {
        setCaught([]);
      }
    });
    return unsub;
  }, []);

  // ── Sauvegarder dans Firestore (debounce 1s) ───────────────────────────────
  useEffect(() => {
    if (!user || savePending) return;
    // Ne pas sauvegarder au premier chargement (caught = [] avant fetch Firestore)
  }, []);

  const saveCaught = async (newCaught, u) => {
    if (!u) return;
    await setDoc(doc(db, "users", u.uid), { caught: newCaught }, { merge: true });
  };

  const toggleCatch = (id, e) => {
    e.stopPropagation();
    setCaught(prev => {
      const next = prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id];
      saveCaught(next, user);
      return next;
    });
  };

  // ── Chargement PokéAPI ─────────────────────────────────────────────────────
  useEffect(() => {
    async function loadEverything() {
      try {
        setLoadingStatus("Chargement des générations...");
        const genListRes = await fetch("https://pokeapi.co/api/v2/generation?limit=100");
        const genListData = await genListRes.json();
        const genDetails = await Promise.all(
          genListData.results.map(g => fetch(g.url).then(r => r.json()))
        );
        genDetails.sort((a, b) => a.id - b.id);
        const builtGens = genDetails.map((g, i) => {
          const ids = g.pokemon_species.map(s => {
            const parts = s.url.split("/").filter(Boolean);
            return parseInt(parts[parts.length - 1]);
          });
          return { index: i, firstId: Math.min(...ids), label: getGenLabel(i, g.name), color: getGenColor(i) };
        });
        builtGens.sort((a, b) => a.firstId - b.firstId);
        setGenerations(builtGens);

        setLoadingStatus("Chargement des espèces...");
        const speciesRes = await fetch("https://pokeapi.co/api/v2/pokemon-species?limit=10000");
        const speciesData = await speciesRes.json();
        const mwb = new Set(speciesData.results.map(s => s.name).filter(n => n.includes("-")));
        setMultiWordBase(mwb);

        setLoadingStatus("Chargement des formes Pokémon...");
        const formsRes = await fetch("https://pokeapi.co/api/v2/pokemon-form?limit=10000");
        const formsData = await formsRes.json();
        setLoadingStatus(`Chargement de ${formsData.results.length} formes...`);
        const details = await Promise.all(
          formsData.results.map(f => fetch(f.url).then(r => r.json()))
        );
        details.sort((a, b) => a.id - b.id);

        setLoadingStatus("Détection du dimorphisme sexuel...");
        const pokemonRes = await fetch("https://pokeapi.co/api/v2/pokemon?limit=10000");
        const pokemonData = await pokemonRes.json();
        const pokemonDetails = await Promise.all(
          pokemonData.results.map(p => fetch(p.url).then(r => r.json()))
        );
        const dimorphSet = new Set();
        for (const p of pokemonDetails) {
          if (p.sprites?.front_female) dimorphSet.add(p.species.name);
        }
        setSexualDimorphism(dimorphSet);

        setAllForms(details);
        setLoading(false);
      } catch (error) {
        console.error("Erreur de chargement", error);
        setLoadingStatus("Erreur de chargement. Rechargez la page.");
      }
    }
    loadEverything();
  }, []);

  const getBaseName = (name) => {
    if (multiWordBase.has(name)) return name;
    for (const base of multiWordBase) {
      if (name.startsWith(base + "-")) return base;
    }
    return name.split("-")[0];
  };

  const getGen = (id) => {
    let gen = generations[0];
    for (const g of generations) { if (id >= g.firstId) gen = g; }
    return gen;
  };

  const toggleExpand = (base, e) => {
    e.stopPropagation();
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(base) ? next.delete(base) : next.add(base);
      return next;
    });
  };

  const groupedMap = new Map();
  for (const p of allForms) {
    const base = getBaseName(p.name);
    if (!groupedMap.has(base)) groupedMap.set(base, []);
    groupedMap.get(base).push(p);
  }

  const q = search.toLowerCase();
  const groups = [...groupedMap.entries()]
    .map(([base, forms]) => {
      const baseForm = forms.find(p => p.name === base) || forms[0];
      const extraForms = forms.filter(p => p.name !== base);
      const matchesSearch = base.includes(q) || forms.some(p => p.name.includes(q));
      const allCaught = forms.every(p => caught.includes(p.id));
      const someCaught = forms.some(p => caught.includes(p.id));
      if (!matchesSearch) return null;
      if (filterType === "caught" && !someCaught) return null;
      if (filterType === "uncaught" && allCaught) return null;
      return { base, forms, baseForm, extraForms, allCaught, someCaught };
    })
    .filter(Boolean);

  const showBanners = !q && generations.length > 0;
  const items = [];
  let lastGenIndex = null;
  for (const group of groups) {
    const gen = getGen(group.baseForm.id);
    if (showBanners && gen?.index !== lastGenIndex) {
      items.push({ type: 'banner', gen });
      lastGenIndex = gen?.index;
    }
    items.push({ type: 'group', group });
  }

  const imgStyle = { width: '80px', height: '80px', objectFit: 'contain' };

  // ── Auth en cours ──────────────────────────────────────────────────────────
  if (user === undefined) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Chargement...</div>;
  }

  // ── Non connecté ───────────────────────────────────────────────────────────
  if (!user) return <LoginScreen />;

  // ── Connecté ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h1 style={{ margin: 0 }}>Pokédex Complet</h1>
        <div style={{ fontSize: 13, color: '#666', textAlign: 'right' }}>
          <span>{user.email}</span>
          <button
            onClick={() => signOut(auth)}
            style={{ marginLeft: 12, padding: '4px 10px', fontSize: 12, cursor: 'pointer', borderRadius: 4, border: '1px solid #ccc' }}>
            Déconnexion
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button onClick={() => setFilterType("all")}>Tous</button>
        <button onClick={() => setFilterType("caught")} style={{ marginLeft: 10 }}>Capturés</button>
        <button onClick={() => setFilterType("uncaught")} style={{ marginLeft: 10 }}>Non capturés</button>
        <p style={{ marginTop: 10, fontSize: '14px', color: '#666' }}>
          Affichage : {groups.length} Pokémon
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '12px', color: '#666' }}>
          <span style={{ backgroundColor: '#f48fb1', color: '#4a0030', borderRadius: 4, padding: '1px 6px', fontWeight: 'bold' }}>♀≠♂</span>
          <span>Dimorphisme sexuel</span>
        </div>
      </div>

      <input
        type="text"
        placeholder="Rechercher (ex: sawsbuck, venusaur, unown)..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ padding: 12, width: "100%", marginBottom: 20, fontSize: '16px', borderRadius: '5px', boxSizing: 'border-box' }}
      />

      {loading ? (
        <div>
          <h2>Chargement en cours...</h2>
          <p style={{ color: '#666' }}>{loadingStatus}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '15px' }}>
          {items.map((item) => {
            if (item.type === 'banner') {
              const { gen } = item;
              return (
                <div key={`banner-${gen.index}`} style={{
                  gridColumn: '1 / -1', backgroundColor: gen.color, color: '#fff',
                  padding: '8px 16px', borderRadius: 8, fontWeight: 'bold', fontSize: '15px',
                }}>
                  {gen.label}
                </div>
              );
            }

            const { base, forms, baseForm, extraForms, allCaught, someCaught } = item.group;
            const open = expanded.has(base) || (q.length > 0 && forms.some(p => p.name.includes(q) && p.name !== base));
            const baseCaught = caught.includes(baseForm.id);

            return (
              <React.Fragment key={base}>
                <div
                  onClick={(e) => extraForms.length > 0 && toggleExpand(base, e)}
                  style={{
                    border: allCaught ? '2px solid #4CAF50' : someCaught ? '2px dashed #81c784' : '1px solid #ccc',
                    borderRadius: 8, padding: 10, textAlign: 'center',
                    backgroundColor: baseCaught ? '#f0fff0' : 'white',
                    cursor: extraForms.length > 0 ? 'pointer' : 'default',
                    position: 'relative',
                  }}>
                  <div style={{ fontSize: '10px', color: '#999', fontWeight: 'bold', marginBottom: 2 }}>
                    #{String(baseForm.id).padStart(4, '0')}
                  </div>
                  {extraForms.length > 0 && (
                    <div style={{
                      position: 'absolute', top: 5, right: 5,
                      backgroundColor: open ? '#555' : '#888', color: 'white',
                      borderRadius: 10, fontSize: '10px', fontWeight: 'bold',
                      padding: '1px 6px', lineHeight: '16px',
                    }}>
                      {open ? '▲' : `+${extraForms.length}`}
                    </div>
                  )}
                  <PokemonImg src={baseForm.sprites.front_default} id={baseForm.id} alt={base} style={imgStyle} />
                  <div style={{ textTransform: 'capitalize', fontWeight: 'bold', fontSize: '11px', marginTop: 5 }}>
                    {base}
                  </div>
                  <GenderBadge hasDimorphism={sexualDimorphism.has(base)} />
                  <label style={{ display: 'block', cursor: 'pointer', marginTop: 8, fontSize: '10px' }}
                    onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={baseCaught} onChange={(e) => toggleCatch(baseForm.id, e)} />
                    {' '}Capturé
                  </label>
                </div>

                {open && extraForms.map((p) => (
                  <div key={p.id} style={{
                    border: caught.includes(p.id) ? '2px solid #4CAF50' : '1px solid #bbb',
                    borderRadius: 8, padding: 10, textAlign: 'center',
                    backgroundColor: caught.includes(p.id) ? '#f0fff0' : '#fafafa',
                    outline: '2px dashed #ccc', outlineOffset: '-4px',
                  }}>
                    <PokemonImg src={p.sprites.front_default} id={p.id} alt={p.name} style={imgStyle} />
                    <div style={{ textTransform: 'capitalize', fontSize: '10px', marginTop: 5, color: '#444' }}>
                      {p.name.replace(base + '-', '')}
                    </div>
                    <GenderBadge hasDimorphism={sexualDimorphism.has(getBaseName(p.name))} />
                    <label style={{ display: 'block', cursor: 'pointer', marginTop: 8, fontSize: '10px' }}>
                      <input type="checkbox" checked={caught.includes(p.id)} onChange={(e) => toggleCatch(p.id, e)} />
                      {' '}Capturé
                    </label>
                  </div>
                ))}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
