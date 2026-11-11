# Central Operacional LSP 133 — Demonstração

Versão estática de demonstração, com **dados 100% fictícios**, quatro páginas e gráficos responsivos.

## Executar localmente

```bash
node scripts/generate-demo.mjs
python -m http.server 8000
```

Abra http://localhost:8000 (o arquivo `index.html` lê `data/indicadores-demo.json`).

## Publicar no GitHub Pages

Em **Settings → Pages → Build and deployment → Source**, selecione **GitHub Actions**. Depois vá em **Actions → Publicar dashboard demonstrativa → Run workflow**.

O workflow gera dados sintéticos e publica os arquivos a cada 30 minutos (o agendamento pode sofrer atrasos). O navegador também busca uma nova versão do JSON a cada minuto, enquanto a página estiver visível.

## Segurança

- Nenhum dado real da Shopee, nome de motorista, AT, BR, segredo ou credencial foi colocado neste repositório.
- O GitHub Pages padrão é **público**, mesmo que o repositório seja privado. Não use este fluxo para indicadores corporativos confidenciais.
- O gerador não acessa Google Sheets, SPX ou Apps Script. Para dados reais, utilize somente uma solução de hospedagem autenticada e fluxo aprovado pela empresa.
- Não insira chaves de API ou tokens no HTML ou JSON.
