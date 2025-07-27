import { useEffect, useRef, useState } from 'react'
import Progress from './components/Progress';
import './App.css'

function App() {
  const [ready, setReady] = useState(null);
  const [disabled, setDisabled] = useState(false);
  const [progressItems, setProgressItems] = useState([]);
  const [input, setInput] = useState('Ordenar por Descrição');
  const [output, setOutput] = useState('');
  const [jsonOutput, setJsonOutput] = useState(null);
  const worker = useRef(null);

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module'
      });
    }

    const onMessageReceived = (e) => {
      switch (e.data.status) {
        case 'initiate':
          setReady(false);
          setProgressItems(prev => [...prev, e.data]);
          break;
        case 'progress':
          setProgressItems(prev => prev.map(item => {
            if (item.file === e.data.file) {
              return { ...item, progress: e.data.progress }
            }
            return item;
          }));
          break;
        case 'done':
          setProgressItems(prev => prev.filter(item => item.file !== e.data.file));
          break;
        case 'ready':
          setReady(true);
          break;
        case 'update':
          setOutput(e.data.output);
          break;
        case 'complete':
          setDisabled(false);
          setJsonOutput(e.data.output);
          setOutput(JSON.stringify(e.data.output, null, 2));
          break;
      }
    };

    worker.current.addEventListener('message', onMessageReceived);
    return () => worker.current.removeEventListener('message', onMessageReceived);
  });

  const translate = () => {
      setDisabled(true);
      setOutput('Processando...');
      setJsonOutput(null);
      
      // Validação básica do input
      if (!input || input.trim().length < 3) {
          setOutput('Por favor, digite um comando válido');
          setDisabled(false);
          return;
      }

      worker.current.postMessage({
          text: input.trim(),
          context: "[{\"field\":\"__check__\",\"description\":null,\"examples\":[false,false,false,false,false],\"type\":\"custom\",\"allowedOperators\":[\"is\"]},{\"field\":\"code\",\"description\":null,\"examples\":[\"CONTRATO\",\"200020\",\"C-00007\",\"100015\",\"200051\"],\"type\":\"string\",\"allowedOperators\":[\"contains\",\"doesNotContain\",\"equals\",\"doesNotEqual\",\"startsWith\",\"endsWith\",\"isEmpty\",\"isNotEmpty\",\"isAnyOf\"]},{\"field\":\"description\",\"description\":null,\"examples\":[\"SP - CMP - ALTA TAQUARAL - 0930\",\"HELIO PELLEGRINO\",\"SP - SPO - MOEMA PASSAROS - 1014\",\"REPUBLICA DO LIBANO\",\"GUILHERME 02\"],\"type\":\"string\",\"allowedOperators\":[\"contains\",\"doesNotContain\",\"equals\",\"doesNotEqual\",\"startsWith\",\"endsWith\",\"isEmpty\",\"isNotEmpty\",\"isAnyOf\"]},{\"field\":\"external_code\",\"description\":null,\"examples\":[\"200242\",\"C-00002\",\"200003\",\"200037\",\"100027\"],\"type\":\"string\",\"allowedOperators\":[\"contains\",\"doesNotContain\",\"equals\",\"doesNotEqual\",\"startsWith\",\"endsWith\",\"isEmpty\",\"isNotEmpty\",\"isAnyOf\"]}]",
      });
  }

  return (
    <>
      <h1>LLM Command Translator</h1>
      <h2>Traduza comandos em linguagem natural para JSON da tabela MUI</h2>

      <div className='container'>
        <div className='textbox-container'>
          <textarea 
            value={input} 
            rows={3} 
            onChange={e => setInput(e.target.value)}
            placeholder="Digite um comando como 'Ordenar por Descrição' ou 'Filtrar por status ativo'"
          ></textarea>
          <textarea 
            value={output} 
            rows={10} 
            readOnly
            style={{ fontFamily: 'monospace' }}
          ></textarea>
        </div>
      </div>

      <button disabled={disabled} onClick={translate}>Processar Comando</button>

      <div className='progress-bars-container'>
        {ready === false && (
          <label>Carregando modelo... (só na primeira vez)</label>
        )}
        {progressItems.map(data => (
          <div key={data.file}>
            <Progress text={data.file} percentage={data.progress} />
          </div>
        ))}
      </div>

      {jsonOutput && jsonOutput.ok && (
        <div className="result-container">
          <h3>Resultado Estruturado:</h3>
          <ul>
            {jsonOutput.data.sorting?.length > 0 && (
              <li>
                <strong>Ordenação:</strong> {jsonOutput.data.sorting.map(s => 
                  `${s.column} (${s.direction})`).join(', ')}
              </li>
            )}
            {jsonOutput.data.filters?.length > 0 && (
              <li>
                <strong>Filtros:</strong> {jsonOutput.data.filters.map(f => 
                  `${f.column} ${f.operator} ${f.value}`).join(', ')}
              </li>
            )}
          </ul>
        </div>
      )}
    </>
  )
}

export default App