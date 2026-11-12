# Shopee / Central Operacional · LSP 133

Dashboard web com quatro páginas, baseada na interface original do Apps Script. O site público é hospedado no GitHub Pages.

## Funcionalidades implementadas

- Identidade visual Shopee no cabeçalho, com símbolo vetorial inspirado no cabeçalho da dashboard original.
- **Controle de Produção:** rotas expedidas, rotas no piso, pacotes expedidos, pacotes no piso e SPR (quando todas as quantidades das rotas expedidas são conhecidas); barras diárias de expedidas, no piso e total, e pacotes por dia.
- **Expedição de Rotas:** Assigned, Complete, atribuições por data, evolução e tabela.
- **Histórico da Produção:** a última captura de cada data operacional, quando disponibilizada pelo sincronizador.
- **Insucessos:** indicadores agregados, taxa VOANDO e devoluções diárias, quando a fonte opcional for conectada.
- **Erros de Expedição:** erros de etiquetagem, outros erros e evolução diária, quando a fonte opcional for conectada.
- Data inicial e final, modo relatório, impressão/PDF e atualização no navegador a cada minuto.

## Origem dos dados

O site prioriza `data/indicadores.json` (dados reais agregados) e usa `data/indicadores-demo.json` só antes da primeira sincronização real. O Pages **não faz login no Google**; ele recebe dados via Apps Script, que grava o JSON usando a API do GitHub. O workflow publica os arquivos estáticos após o commit.

O código de integração para copiar ao **projeto Apps Script original** está em `integracao/AppsScript_Sync_LSP133.gs`. Não é executado diretamente pelo GitHub Actions.

### Propriedades necessárias (Apps Script → Configurações do projeto → Propriedades do script)

| Nome | Valor |
| --- | --- |
| `SOURCE_SPREADSHEET_ID` | ID da planilha Validação de Dados |
| `GITHUB_TOKEN` | Token fine-grained restrito ao repositório, permissão Contents: Read and write |
| `PUBLICATION_APPROVED` | `YES`, apenas após autorização para publicação pública |
| `INSUCESSOS_SPREADSHEET_ID` | **Opcional**: ID da planilha com abas Dashboard e informações de insucessos |
| `ERROS_SPREADSHEET_ID` | **Opcional**: ID da planilha com aba Base Erros Consolidada |

Depois de atualizar o arquivo `Sync_GitHub.gs`, salve e execute `syncLsp133ToGitHub` uma vez. Verifique os quatro KPIs com `Folha 1!G2:J2`. Só após validação configure `installLsp133SyncTrigger` para a execução periódica. Se o gatilho já existe, **não é necessário recriá-lo** ao mudar o código.

### Regras e limites atuais

- Os quatro indicadores principais são calculados pela aba `Folha 1`, reproduzindo os status da coluna F e os pacotes conhecidos da coluna D. A função valida a igualdade exata com `Folha 1!G2:J2` e bloqueia divergências.
- `SPR = pacotes expedidos / rotas expedidas` no período filtrado. É apresentado como **indisponível** quando há quantidades pendentes.
- Histórico usa **a captura mais recente por data operacional**, sem alterar os KPIs atuais. A disponibilidade das capturas depende do fluxo original.
- Insucessos: os KPIs da aba Dashboard são valores globais da fonte; o filtro de datas atua no gráfico e tabela de devoluções. Não interpretar os KPIs globais como dados filtrados.
- Erros: o consolidado considera códigos BR **únicos por data e tipo**, e não o número bruto de linhas. Essa métrica pode diferir dos cards existentes na planilha, caso preservem duplicidades; validar antes de usar gerencialmente.
- Atribuição de rotas usa **data de atribuição**, enquanto produção usa **data operacional**. Não são métricas intercambiáveis.
- O site é **público**. O JSON contém apenas indicadores consolidados, sem nome, AT, BR, operadores nem tokens. A autorização interna deve contemplar a divulgação pública.
- A marca no cabeçalho não é uma declaração de que o site seja um portal corporativo oficialmente hospedado pela Shopee.

## Publicar

Em Settings → Pages, use **GitHub Actions**. O workflow `.github/workflows/pages.yml` é executado a cada push no main, manualmente ou no agendamento de 30 minutos; o commit de dados pelo Apps Script normalmente dispara uma nova publicação.

## Executar localmente

```bash
node scripts/generate-demo.mjs
python -m http.server 8000
```

Abra http://localhost:8000. Para interromper a rotina Apps Script: execute `stopLsp133SyncTrigger` no projeto original.
