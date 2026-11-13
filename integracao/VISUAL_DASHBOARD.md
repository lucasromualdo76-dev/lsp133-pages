# Visual da Central Operacional

No GitHub Pages, a página usa cartões principais, gráfico de colunas e detalhes recolhíveis. Em Expedição, capturas diárias e eventos da carga atual têm descrições próprias: não somar conclusões de uma data aos status de outra. Capturas com datas futuras ficam nos detalhes e não são promovidas ao indicador de última captura.

## Apps Script

1. Abra o projeto **LSP 133 - Central Operacional**, arquivo **Index.html**.
2. Copie o conteúdo de **Visual_Dashboard.html** e cole uma única vez imediatamente antes de `</body>`.
3. Salve. Em **Implantar → Gerenciar implantações**, edite a implantação existente, selecione **Nova versão** e implante.
4. Atualize a dashboard. Expedição deverá mostrar um gráfico principal de barras, com status, origens, horários e ATs em seções que podem ser abertas.

O complemento usa as funções já existentes `productionSvgChart` e `expTrend`. Não substitui Código.gs, não muda fontes de dados, valores ou critérios de contagem e não renova a sessão SPX. Para remover, exclua somente o complemento inserido no final do Index.html.

Conferido em navegador a 1440 px e 390 px, incluindo valores de KPI, barras, detalhes e período sem dados. A instalação no projeto Apps Script deve ser realizada pelo proprietário; o commit no GitHub não altera a implantação Google.
