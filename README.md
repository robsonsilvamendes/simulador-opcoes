# Simulador de Opções

Simulador visual e didático para estudar opções de ações (calls, puts e estratégias).
Roda 100% no navegador, **sem instalar nada e sem internet**.

## Como abrir

Dê dois cliques em `index.html` (ou arraste para o Chrome/Safari/Firefox).

## O que tem em cada aba

| Aba | Para que serve |
|---|---|
| 📚 Fundamentos | Trilha de estudo, analogia, as 4 posições básicas, ITM/ATM/OTM, decodificador de código B3, glossário |
| 🎯 Payoff | Uma opção: gráfico de lucro/prejuízo, breakeven, chance de lucro, cenário clicável e explicação passo a passo |
| 🧩 Estratégias | 15 estratégias prontas + montagem livre, curva "hoje × vencimento", mapa de calor preço×tempo, gregas líquidas |
| 🔬 Gregas | Delta, gamma, theta, vega e rho com gráficos por prazo e exemplos numéricos |
| ⏳ Tempo e volatilidade | Derretimento do prêmio, efeito da vol, calculadora de volatilidade implícita, cone de preços |
| 🎲 Monte Carlo | Milhares de trajetórias da estratégia montada: distribuição de resultados, chance de lucro, convergência |

A barra do topo (preço do ativo, volatilidade, Selic, dias até o vencimento) alimenta todas as abas.
Passe o mouse nos termos com sublinhado pontilhado para ver a definição.

## Premissas e limites

- Preços teóricos por **Black-Scholes** (opção europeia, sem dividendos), prazo em dias corridos / 365.
  Opções de ações na B3 costumam ser americanas; o modelo é uma aproximação didática.
- Lote padrão de 100 opções. Não considera corretagem, emolumentos, impostos, spreads nem margem.
- Monte Carlo com volatilidade constante (sem saltos nem caudas gordas).
- Ferramenta de estudo, **não é recomendação de investimento**.

## Estrutura

```
index.html            página
css/style.css         tema claro/escuro (segue o sistema; botão "Tema" alterna)
js/bs.js              Black-Scholes, gregas, volatilidade implícita
js/strat.js           pernas, payoff, breakevens, probabilidade, catálogo de estratégias
js/charts.js          gráficos SVG próprios (linha, histograma, mapa de calor)
js/ui.js              componentes, formatação pt-BR, glossário
js/tab-*.js           uma aba por arquivo
js/main.js            abas, barra de mercado, tema
```

Para criar uma estratégia nova, adicione um item em `PRESETS` no `js/strat.js`.
