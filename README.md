# Shopee / Central Operacional · LSP 133

Dashboard web com quatro páginas, baseada na interface original do Apps Script. O site público é hospedado no GitHub Pages.

## Funcionalidades implementadas

- Identidade visual Shopee no cabeçalho, com símbolo vetorial inspirado no cabeçalho da dashboard original.
- **Controle de Produção:** rotas expedidas, rotas no piso, pacotes expedidos, pacotes no piso e SPR (quando todas as quantidades das rotas expedidas são conhecidas); barras diárias de expedidas, no piso e total, e pacotes por dia.
- **Expedição de Rotas:** gráfico combinado com **colunas do total de rotas por data operacional** e **linha de atribuições pelo horário V (Driver Assigned Time)**, além de gráfico e tabela de **conclusões pelo horário U (Complete time)**. A captura histórica do sistema permanece em quadro separado. Dias sem carimbo V podem exibir zero registros, mas isso não comprova ausência de atribuição.
- **Histórico da Produção:** a última captura de cada data operacional, quando disponibilizada pelo sincronizador.
- **Insucessos:** indicadores agregados, taxa VOANDO e devoluções diárias, quando a fonte opcional for conectada.
- **Erros de Expedição:** erros de etiquetagem, outros erros e evolução diária, quando a fonte opcional for conectada.
- Rótulos numéricos sobre as colunas em todas as páginas, e sobre os pontos da linha de atribuição. Gráficos amplos oferecem rolagem horizontal para evitar valores sobrepostos.\n- Data inicial e final, modo relatório, impressão/PDF e atualização no navegador a cada minuto.

## Origem dos dados

O site prioriza `data/indicadores.json` (dados reais agregados) e usa `data/indicadores-demo.json` só antes da primeira sincronização real. O Pages **não faz login no Google**; ele recebe dados via Apps Script, que grava o JSON usando a API do GitHub. O workflow publica os arquivos estáticos após o commit.

O código de integração para copiar ao **projeto Apps Script original** está em `integracao/AppsScript_Sync_LSP133.gs`. Não é executado diretamente pelo GitHub Actions. Atualizar esse arquivo no GitHub não instala a versão nova no Google: substitua o conteúdo de `Sync_GitHub.gs` no Apps Script, salve e execute `syncLsp133ToGitHub`.

### Propriedades necessárias (Apps Script → Configurações do projeto → Propriedades do script)

| Nome | Valor |
| --- | --- |
| `SOURCE_SPREADSHEET_ID` | ID da planilha Validação de Dados |
| `GITHUB_TOKEN` | Token fine-grained restrito ao repositório, permissão Contents: Read and write |
| `PUBLICATION_APPROVED` | `YES`, apenas após autorização para publicação pública |
| `INSUCESSOS_SPREADSHEET_ID` | **Opcional**: ID da planilha com abas Dashboard e informações de insucessos |
| `ERROS_SPREADSHEET_ID` | **Opcional**: ID da planilha com aba Base Erros Consolidada |

Depois de atualizar o arquivo `Sync_GitHub.gs`, salve e execute `syncLsp133ToGitHub` uma vez. Verifique os quatro KPIs com a `Base de Produção`. O sincronizador confere cada AT com a Folha 1, excluindo as marcadas como `Desmanchada` em `Controle ATs Desmanchadas`. Os cards G2:J2 da Folha 1 podem incluir essas ATs e deixam de ser a referência de validação. Só após validação configure `installLsp133SyncTrigger` para a execução periódica. Se o gatilho já existe, **não é necessário recriá-lo** ao mudar o código.

### Regra auditada: rotas concluídas e atribuições

A auditoria de 11/11/2026 confirmou a leitura correta dos campos da aba `Atribuição de Entrega`:

- **A** — Task ID (AT); agrupar por AT única, pois os pacotes repetem a rota em muitas linhas.
- **N** — Delivery Date: data operacional da rota, **não** o dia em que ela foi concluída.
- **U** — Complete time: data/hora de conclusão, contada se o status atual **W = Complete**.
- **V** — Driver Assigned Time: data/hora em que a rota foi atribuída ao motorista.
- **W** — Status atual: `Complete` significa concluída agora; por si só não identifica em que dia ocorreu a conclusão.

O `Resumo de Expedição` original baseia-se no `Histórico de Expedição`, que possui capturas registradas a partir de 10/11. Para mostrar dias anteriores, o sincronizador reconstrói eventos pelas colunas U e V diretamente da origem, contando ATs únicas presentes na `Base de Produção`, após excluir as desmanchadas. Os dados reconstruídos **podem diferir das capturas históricas** de 10 e 11/11, pois as janelas e os critérios são diferentes.

**Conferência de referência (fotografia da base em 11/11):** 981 ATs, 592 com status `Complete`, 426 conclusões com data U antes de 10/11, 415 atribuições V antes de 10/11 e 10 ATs expedidas/concluídas sem horário V. Não assuma que esses valores são constantes ao longo do tempo.

**FIFO**: não reportar percentual de aderência sem observar quais rotas estavam elegíveis no momento de cada atribuição. A distribuição das datas operacionais por dia de atribuição é útil para investigação, mas não comprova adesão por si só.

### Regras e limites atuais

- Os quatro indicadores principais usam `Base de Produção`, que exclui as ATs marcadas como `Desmanchada` em `Controle ATs Desmanchadas`. O sincronizador confere cabeçalhos, ATs, datas, status e quantidades contra a Folha 1 descontando as desmanchadas. Base incompleta ou divergente bloqueia a publicação.
- Pacotes usam a quantidade auditada, conforme `getProductionData` do aplicativo original, inclusive para piso. A exclusão de ATs desmanchadas não equivale a excluir dias inteiros; o sincronizador não aplica as exclusões integrais de datas configuradas na aba Dashboard da planilha.
- Concluídas ausentes da carga atual só são aceitas se confirmadas como `Completa` em `ATs Preservadas`. Elas permanecem nos totais de produção, sem datas de conclusão inventadas. `eventQuality` informa a quantidade preservada fora da carga atual.
- A leitura do Resumo de Expedição preserva as capturas históricas; a correção do piso não reescreve esses registros. A exclusão das desmanchadas se aplica à produção atual; capturas antigas de produção não são recalculadas.
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
