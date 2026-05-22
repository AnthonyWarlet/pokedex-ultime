import React, { useState, useEffect } from "react";

// Couleurs par numéro de génération (index 0 = gen 1)
const GEN_COLORS = [
  "#e53935", "#fb8c00", "#43a047", "#1e88e5",
  "#8e24aa", "#00acc1", "#f4511e", "#6d4c41", "#c62828",
];
// Noms des régions par génération
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

export default function App() {
  const [allForms, setAllForms] = useState([]);
  const [generations, setGenerations] = useState([]); // [{gen, firstId, label, color}]
  const [sexualDimorphism, setSexualDimorphism] = useState(new Set());
  const [multiWordBase, setMultiWordBase] = useState(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState("Démarrage...");
  const [filterType, setFilterType] = useState("all");
  const [expanded, setExpanded] = useState(new Set());

  const [caught, setCaught] = useState(() => {
    const saved = localStorage.getItem("caughtPokemon");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    async function loadEverything() {
      try {
        // ── 1. Générations ──────────────────────────────────────────
        setLoadingStatus("Chargement des générations...");
        const genListRes = await fetch("https://pokeapi.co/api/v2/generation?limit=100");
        const genListData = await genListRes.json();

        const genDetails = await Promise.all(
          genListData.results.map(g => fetch(g.url).then(r => r.json()))
        );
        // Trier par id
        genDetails.sort((a, b) => a.id - b.id);

        // Pour chaque gen, trouver l'id minimum de ses espèces
        const builtGens = genDetails.map((g, i) => {
          const ids = g.pokemon_species.map(s => {
            const parts = s.url.split("/").filter(Boolean);
            return parseInt(parts[parts.length - 1]);
          });
          const firstId = Math.min(...ids);
          return {
            index: i,
            firstId,
            label: getGenLabel(i, g.name),
            color: getGenColor(i),
          };
        });
        builtGens.sort((a, b) => a.firstId - b.firstId);
        setGenerations(builtGens);

        // ── 2. Noms d'espèces (pour détecter les noms multi-mots) ──
        setLoadingStatus("Chargement des espèces...");
        const speciesRes = await fetch("https://pokeapi.co/api/v2/pokemon-species?limit=10000");
        const speciesData = await speciesRes.json();
        const speciesNames = new Set(speciesData.results.map(s => s.name));
        // Un nom est "multi-mots" s'il contient un "-" ET existe tel quel comme espèce
        const mwb = new Set([...speciesNames].filter(n => n.includes("-")));
        setMultiWordBase(mwb);

        // ── 3. Formes ───────────────────────────────────────────────
        setLoadingStatus("Chargement des formes Pokémon...");
        const formsRes = await fetch("https://pokeapi.co/api/v2/pokemon-form?limit=10000");
        const formsData = await formsRes.json();

        setLoadingStatus(`Chargement de ${formsData.results.length} formes...`);
        const details = await Promise.all(
          formsData.results.map(f => fetch(f.url).then(r => r.json()))
        );
        details.sort((a, b) => a.id - b.id);

        // ── 4. Dimorphisme : détecter via sprite front_female ───────
        setLoadingStatus("Détection du dimorphisme sexuel...");
        // On cherche les espèces dont AU MOINS UNE forme a un sprite féminin
        // Pour ne pas faire 1000 requêtes, on utilise l'endpoint pokemon (pas pokemon-form)
        // qui contient aussi les sprites et est disponible par espèce
        const pokemonRes = await fetch("https://pokeapi.co/api/v2/pokemon?limit=10000");
        const pokemonData = await pokemonRes.json();
        const pokemonDetails = await Promise.all(
          pokemonData.results.map(p => fetch(p.url).then(r => r.json()))
        );
        const dimorphSet = new Set();
        for (const p of pokemonDetails) {
          if (p.sprites?.front_female) {
            // Le nom de base est le nom de l'espèce, qu'on extrait depuis species.name
            dimorphSet.add(p.species.name);
          }
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

  useEffect(() => {
    localStorage.setItem("caughtPokemon", JSON.stringify(caught));
  }, [caught]);

  const getBaseName = (name) => {
    if (multiWordBase.has(name)) return name;
    for (const base of multiWordBase) {
      if (name.startsWith(base + "-")) return base;
    }
    return name.split("-")[0];
  };

  const getGen = (id) => {
    let gen = generations[0];
    for (const g of generations) {
      if (id >= g.firstId) gen = g;
    }
    return gen;
  };

  const toggleCatch = (id, e) => {
    e.stopPropagation();
    setCaught(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
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

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Pokédex Complet</h1>

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
        style={{ padding: 12, width: "100%", marginBottom: 20, fontSize: '16px', borderRadius: '5px' }}
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
                  gridColumn: '1 / -1',
                  backgroundColor: gen.color,
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontWeight: 'bold',
                  fontSize: '15px',
                }}>
                  {gen.label}
                </div>
              );
            }

            const { base, forms, baseForm, extraForms, allCaught, someCaught } = item.group;
            const open = expanded.has(base) || (q.length > 0 && forms.some(p => p.name.includes(q) && p.name !== base));
            const baseCaught = caught.includes(baseForm.id);
            const hasDimorphism = sexualDimorphism.has(base);

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
                      backgroundColor: open ? '#555' : '#888',
                      color: 'white', borderRadius: 10,
                      fontSize: '10px', fontWeight: 'bold',
                      padding: '1px 6px', lineHeight: '16px',
                    }}>
                      {open ? '▲' : `+${extraForms.length}`}
                    </div>
                  )}

                  <PokemonImg src={baseForm.sprites.front_default} id={baseForm.id} alt={base} style={imgStyle} />
                  <div style={{ textTransform: 'capitalize', fontWeight: 'bold', fontSize: '11px', marginTop: 5 }}>
                    {base}
                  </div>
                  <GenderBadge hasDimorphism={hasDimorphism} />
                  <label style={{ display: 'block', cursor: 'pointer', marginTop: 8, fontSize: '10px' }}
                    onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={baseCaught}
                      onChange={(e) => toggleCatch(baseForm.id, e)}
                    />
                    {' '}Capturé
                  </label>
                </div>

                {open && extraForms.map((p) => (
                  <div key={p.id} style={{
                    border: caught.includes(p.id) ? '2px solid #4CAF50' : '1px solid #bbb',
                    borderRadius: 8, padding: 10, textAlign: 'center',
                    backgroundColor: caught.includes(p.id) ? '#f0fff0' : '#fafafa',
                    outline: '2px dashed #ccc',
                    outlineOffset: '-4px',
                  }}>
                    <PokemonImg src={p.sprites.front_default} id={p.id} alt={p.name} style={imgStyle} />
                    <div style={{ textTransform: 'capitalize', fontSize: '10px', marginTop: 5, color: '#444' }}>
                      {p.name.replace(base + '-', '')}
                    </div>
                    <GenderBadge hasDimorphism={sexualDimorphism.has(getBaseName(p.name))} />
                    <label style={{ display: 'block', cursor: 'pointer', marginTop: 8, fontSize: '10px' }}>
                      <input
                        type="checkbox"
                        checked={caught.includes(p.id)}
                        onChange={(e) => toggleCatch(p.id, e)}
                      />
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
