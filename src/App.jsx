import React, { useState, useEffect } from "react";


export default function App() {

  const [allForms, setAllForms] = useState([]);

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

  // État pour le filtre des boutons
  const [filterType, setFilterType] = useState("all");

  

  // Gestion de la persistance des captures

  const [caught, setCaught] = useState(() => {

    const saved = localStorage.getItem("caughtPokemon");

    return saved ? JSON.parse(saved) : [];

  });


  useEffect(() => {

    async function loadAllForms() {

      try {

        // La route "pokemon-form" est la plus exhaustive pour les variantes (saisons, mégas, etc.)

        const res = await fetch("https://pokeapi.co/api/v2/pokemon-form?limit=2000");

        const data = await res.json();

        

        const details = await Promise.all(data.results.map(async (f) => {

          const res = await fetch(f.url);

          return await res.json();

        }));


        setAllForms(details);

        setLoading(false);

      } catch (error) {

        console.error("Erreur de chargement", error);

        setLoading(false);

      }

    }

    loadAllForms();

  }, []);


  useEffect(() => {

    localStorage.setItem("caughtPokemon", JSON.stringify(caught));

  }, [caught]);


  const toggleCatch = (id) => {

    setCaught(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  };


  // Logique de filtrage par recherche ET par bouton
  const filtered = allForms.filter(p => {
    const matchesSearch = p.name.includes(search.toLowerCase());
    const isCaught = caught.includes(p.id);
    
    if (filterType === "caught") return matchesSearch && isCaught;
    if (filterType === "uncaught") return matchesSearch && !isCaught;
    return matchesSearch;
  });


  return (

    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>

      <h1>Pokédex Complet Sans Dimorphisme</h1>

      
      {/* Boutons de filtrage */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => setFilterType("all")}>Tous</button>
        <button onClick={() => setFilterType("caught")} style={{ marginLeft: 10 }}>Capturés</button>
        <button onClick={() => setFilterType("uncaught")} style={{ marginLeft: 10 }}>Non capturés</button>
      </div>


      <input

        type="text"

        placeholder="Rechercher (ex: sawsbuck, venusaur-mega, unown)..."

        value={search}

        onChange={(e) => setSearch(e.target.value)}

        style={{ padding: 12, width: "100%", marginBottom: 20, fontSize: '16px', borderRadius: '5px' }}

      />


      {loading ? (

        <h2>Chargement exhaustif de toutes les formes...</h2>

      ) : (

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '15px' }}>

          {filtered.map((p) => (

            <div key={p.id} style={{

              border: caught.includes(p.id) ? '2px solid #4CAF50' : '1px solid #ccc',

              borderRadius: 8, padding: 10, textAlign: 'center',

              backgroundColor: caught.includes(p.id) ? '#f0fff0' : 'white'

            }}>

              {/* Utilisation de sprites front_default car c'est la seule URL garantie pour chaque forme */}

              <img

                src={p.sprites.front_default}

                alt={p.name}

                style={{ width: '80px', height: '80px', objectFit: 'contain' }}

                

              />

              <div style={{ textTransform: 'capitalize', fontWeight: 'bold', fontSize: '11px', marginTop: 5 }}>

                {p.name}

              </div>

               <div style={{ textTransform: 'capitalize', fontWeight: 'bold', fontSize: '11px', marginTop: 5 }}>

              </div> 

              <div style={{ textTransform: 'capitalize', fontWeight: 'bold', fontSize: '11px', marginTop: 5 }}>

              </div>


              <label style={{ display: 'block', cursor: 'pointer', marginTop: 8, fontSize: '10px' }}>

                <input

                  type="checkbox"

                  checked={caught.includes(p.id)}

                  onChange={() => toggleCatch(p.id)}

                />

                Capturé

              </label>

            </div>

          ))}

        </div>

      )

      }

    </div>

  );

}