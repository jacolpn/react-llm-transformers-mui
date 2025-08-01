import { pipeline } from '@xenova/transformers';

class MyCommandPipeline {
    static task = 'text2text-generation';
    static model = 'Xenova/LaMini-Flan-T5-783M';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            console.log('Initializing pipeline for the first time...');
            this.instance = pipeline(this.task, this.model, { 
                progress_callback,
                cache_dir: 'llm-cache',
                quantized: true,
                local_files_only: false
            });
        }
        return this.instance;
    }
}

self.addEventListener('message', async (event) => {
    console.log('Worker received message:', event.data);
    
    try {
        const { text, context: contextString } = event.data;
        console.log('Processing command:', text);

        let context;

        try {
            context = JSON.parse(contextString || '[]');
            if (!Array.isArray(context)) {
                throw new Error('Context must be an array');
            }
            console.log('Context loaded with', context.length, 'fields');
        } catch (e) {
            console.error('Context parsing error:', e);
            context = [];
        }

        // Carrega o modelo
        console.log('Loading model...');
        const generator = await MyCommandPipeline.getInstance((progress) => {
            self.postMessage(progress);
        });

        // Formata o prompt
        const fieldsList = context.length > 0 
            ? context.map(f => `- ${f.field} (${f.type}): ${f.description || 'Sem descrição'}`).join('\n')
            : '- Nenhum campo disponível no contexto';

        const prompt = `
            Você é um assistente que converte comandos em JSON estruturado para operações em tabelas.
            CONTEXTO DA TABELA (campos disponíveis):
            ${fieldsList}

            COMANDO DO USUÁRIO: "${text}"

            FORMATO DE RESPOSTA EXATO (apenas JSON):
            {
              "ok": true,
              "data": {
                "sorting": [{
                  "column": "nome_do_campo",
                  "direction": "asc|desc"
                }],
                "filters": [],
                "conversationId": "id_aleatorio"
              }
            }

            REGRAS:
            1. Use apenas os campos listados no contexto (se houver)
            2. "direction" deve ser "desc" se o comando mencionar "decrescente" ou "desc", caso contrário "asc"
            3. Se não entender, retorne:
            {
              "ok": false,
              "message": "Não entendi o comando"
            }
            
            RESPONDA APENAS COM O JSON, SEM COMENTÁRIOS!
        `;

        console.log('Generated prompt:', prompt);

        // Executa o modelo
        console.log('Running model...');
        const output = await generator(prompt, {
            max_length: 500,
            temperature: 0.1,
            no_repeat_ngram_size: 3
        });

        console.log('Model output:', output);
        

        // Processa a saída
        let jsonResponse;
        try {
            const jsonMatch = output[0].generated_text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No JSON found in response');
            
            jsonResponse = JSON.parse(jsonMatch[0]);
            
            if (!jsonResponse.data || !jsonResponse.data.sorting) {
                throw new Error('Invalid structure');
            }
            
            if (context.length > 0) {
                const validFields = context.map(f => f.field);
                jsonResponse.data.sorting.forEach(sort => {
                    if (!validFields.includes(sort.column)) {
                        throw new Error(`Invalid field: ${sort.column}`);
                    }
                });
            }
            
        } catch (e) {
            console.error('Processing error:', e);
            jsonResponse = {
                ok: false,
                message: `Não foi possível processar: "${text}"`,
                error: e.message
            };
        }

        console.log('Final response:', response);

        self.postMessage({
            status: 'complete',
            output: jsonResponse
        });

    } catch (error) {
        console.error('Worker error:', error);
        self.postMessage({
            status: 'error',
            output: {
                ok: false,
                message: `Erro no processamento: ${error.message}`
            }
        });
    }
});
