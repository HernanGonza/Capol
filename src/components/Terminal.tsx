import { useState, useRef, useEffect } from "react";



export default function Terminal({ codigoInicial = "", editable = true, onExecute, resultado }) {

const [codigo, setCodigo] = useState(codigoInicial);

const [output, setOutput] = useState("");

const [isRunning, setIsRunning] = useState(false);

const textareaRef = useRef(null);



// Auto-resize del textarea

useEffect(() => {

if (textareaRef.current) {

textareaRef.current.style.height = "auto";

textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";

}

}, [codigo]);



// Función para ejecutar código (sandbox básico)

const ejecutarCodigo = async () => {

setIsRunning(true);

setOutput("");


// Capturar console.log

const logs = [];

const originalLog = console.log;

const originalError = console.error;


console.log = (...args) => {

logs.push(args.map(arg =>

typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)

).join(" "));

originalLog(...args);

};


console.error = (...args) => {

logs.push(`❌ Error: ${args.join(" ")}`);

originalError(...args);

};



try {

// Ejecutar en un timeout para permitir actualización de UI

await new Promise(resolve => setTimeout(resolve, 100));


// Evaluar código (en producción usar Web Worker o backend)

const resultado = eval(codigo);


if (resultado !== undefined && !logs.length) {

logs.push(`→ ${typeof resultado === "object" ? JSON.stringify(resultado, null, 2) : resultado}`);

}


setOutput(logs.join("\n") || "✅ Código ejecutado (sin output)");


if (onExecute) onExecute(logs.join("\n"));


} catch (error) {

setOutput(`❌ ${error.name}: ${error.message}\n\n💡 Tip: Revisá sintaxis y variables definidas`);

} finally {

// Restaurar consola

console.log = originalLog;

console.error = originalError;

setIsRunning(false);

}

};



// Atajo Ctrl+Enter o Cmd+Enter para ejecutar

const handleKeyDown = (e) => {

if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {

e.preventDefault();

ejecutarCodigo();

}

};



return (

<div className="bg-black rounded-2xl border border-zinc-800 overflow-hidden">

{/* Header de la terminal */}

<div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">

<div className="flex items-center gap-2">

<span className="w-3 h-3 rounded-full bg-red-500"></span>

<span className="w-3 h-3 rounded-full bg-yellow-500"></span>

<span className="w-3 h-3 rounded-full bg-green-500"></span>

<span className="ml-2 text-xs text-zinc-500 font-mono">console.js</span>

</div>

{editable && (

<button

onClick={ejecutarCodigo}

disabled={isRunning}

className={`

flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition

${isRunning

? "bg-zinc-700 text-zinc-400 cursor-not-allowed"

: "bg-emerald-600 hover:bg-emerald-500 text-white"

}

`}

>

{isRunning ? (

<>

<span className="animate-spin">⟳</span> Ejecutando...

</>

) : (

<>

<span>▶</span> Ejecutar <kbd className="ml-1 px-1.5 py-0.5 bg-zinc-800 rounded text-xs">Ctrl+Enter</kbd>

</>

)}

</button>

)}

</div>



{/* Área de código */}

{editable ? (

<textarea

ref={textareaRef}

value={codigo}

onChange={(e) => setCodigo(e.target.value)}

onKeyDown={handleKeyDown}

className="

w-full font-mono text-sm bg-black text-emerald-400 p-4

resize-none outline-none min-h-[200px] max-h-[400px]

placeholder:text-zinc-600

"

placeholder="// Escribí tu código JavaScript aquí...&#10;// Ej: console.log('Hola Node!');"

spellCheck={false}

/>

) : (

<pre className="font-mono text-sm text-emerald-400 p-4 overflow-x-auto whitespace-pre-wrap">

{codigo}

</pre>

)}



{/* Output */}

{(output || isRunning) && (

<div className="border-t border-zinc-800">

<div className="px-4 py-2 bg-zinc-900/50 text-xs text-zinc-500 flex items-center gap-2">

<span>📤 Output:</span>

{isRunning && <span className="animate-pulse">●</span>}

</div>

<div className="terminal p-4 font-mono text-sm text-zinc-300 bg-zinc-950/50 min-h-[80px] max-h-[200px] overflow-y-auto">

<pre className="whitespace-pre-wrap">{output}</pre>

</div>

</div>

)}

</div>

);

}