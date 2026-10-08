# 🧪 Tubos

Jogo de ordenar líquidos por cor, feito com **HTML, CSS e JavaScript puros**: sem framework, sem build e sem dependências. Toque em um tubo para levantá-lo, toque em outro para despejar e deixe cada tubo com uma cor só.

São **50 níveis** que começam com 2 cores e 3 tubos e terminam com 10 cores e 12 tubos, misturando tubos de tamanhos diferentes no caminho. Todos os níveis foram verificados por um solver: **todos têm solução**.

---

## ✨ O que tem

| | |
|---|---|
| 🎮 **Jogabilidade** | Toque ou clique, no celular e no desktop. Não precisa esperar a animação para fazer a próxima jogada. |
| 🫗 **Animação de despejo** | O tubo voa até o destino, inclina, e um filete de líquido escorre enquanto um tubo esvazia e o outro enche. |
| 🔊 **Sons** | *Glub glub* gravado de verdade (o tom sobe conforme o tubo enche), "tuc" ao levantar o tubo, cliques nos botões, acorde ao fechar um tubo e fanfarra na vitória. |
| ✨ **Celebração** | O tubo completo dá um pulinho, brilha e solta faíscas na cor do líquido. |
| ↶ **Desfazer e recomeçar** | Desfaz quantas jogadas quiser ou recomeça o nível, mesmo no meio de uma animação. |
| ❓ **Tutorial** | "Como jogar" abre na primeira visita e pelo botão **?**. |
| 🔒 **Progressão** | Todo mundo começa no nível 1. Vencer libera o próximo, e o progresso fica salvo no navegador. |
| ♿ **Acessibilidade** | Texturas além das cores (listras, bolinhas, xadrez…), descrição de cada tubo para leitores de tela, jogo pelo teclado e suporte a "reduzir movimento". |

---

## 🚀 Como rodar

O jogo carrega os níveis com `fetch`, então precisa de um servidor local. Abrir o `index.html` direto do disco não funciona.

```bash
# qualquer um destes, dentro da pasta do projeto
python -m http.server 8000
npx serve
```

Depois abra **http://localhost:8000**.

### Hospedagem

É um site 100% estático: dá para publicar a pasta como está em GitHub Pages, Netlify, Vercel, Cloudflare Pages ou qualquer servidor de arquivos.

> **Sobre o progresso:** o nível liberado fica no `localStorage` de cada navegador e não aparece na URL. Os arquivos `levels/*.json` continuam acessíveis para quem souber o endereço; esconder os níveis de verdade exigiria um servidor que só entrega o nível liberado.

---

## 🕹️ Como jogar

1. **Objetivo:** cada tubo deve terminar com uma única cor.
2. **Despejar:** toque em um tubo para selecioná-lo e depois no destino.
3. **Regras:** só dá para despejar sobre a mesma cor ou num tubo vazio, e o destino precisa ter espaço. Todas as camadas seguidas da mesma cor no topo vão juntas, até onde couber.
4. **Vitória:** cada cor reunida inteira num único tubo.

---

## 📈 Curva de dificuldade

| Níveis | Cores | Tubos |
|---|---|---|
| 1–2 | 2 | 3 |
| 3–5 | 3 | 5 |
| 6–9 | 4 | 6 |
| 10–14 | 5 | 7 |
| 15–20 | 6 | 8 |
| 21–27 | 7 | 9 |
| 28–35 | 8 | 10 |
| 36–43 | 9 | 11 |
| 44–50 | 10 | 12 |

- **Tubos de tamanhos variados** a partir do nível 4, em um de cada três níveis: cada cor tem de 3 a 7 camadas e termina num tubo do seu tamanho. Os tubos altos ficam num grupo separado à esquerda.
- **Tubos de 5 camadas** nos múltiplos de 5 a partir do 15.
- **Níveis especiais:** 12 · Clássico, 25 · Torres e 40 · Designer Eye.
- Dentro de cada faixa, o gerador testa vários embaralhamentos e escolhe um mais fácil no começo da faixa e um mais difícil no fim.

---

## 🗂️ Estrutura

```
index.html            página e tutorial
style.css             visual, tubos, animações e texturas
game.js               interface: toque, animações, sons, desfazer, progresso
rules.js              regras, validação de nível e solver (navegador e Node)
level.schema.json     JSON Schema do formato de nível
levels/
  level-001…050.json  campanha
  bases/              gabaritos resolvidos usados nos níveis especiais
sounds/glub.mp3       som do despejo
tools/tubos.mjs       ferramenta de níveis (Node 18+)
```

---

## 🧩 Criando níveis

Cada nível é um JSON. O conteúdo de cada tubo vai **do fundo para o topo**:

```json
{
  "$schema": "../level.schema.json",
  "id": "level-051",
  "name": "Nível 51",
  "colors": {
    "red":  { "color": "#ef4444", "pattern": "solid",   "label": "vermelho" },
    "blue": { "color": "#3b82f6", "pattern": "stripes", "label": "azul" }
  },
  "tubes": [
    { "capacity": 4, "contents": ["red", "blue", "red", "blue"] },
    { "capacity": 4, "contents": ["blue", "red", "blue", "red"] },
    { "capacity": 4, "contents": [] }
  ],
  "layout": { "groups": [[[0, 1, 2]]] }
}
```

- **`pattern`**: `solid`, `stripes`, `vstripes`, `diagonal`, `dots`, `checker`, `grid` ou `wood`.
- **`label`**: nome da cor lido pelos leitores de tela.
- **`layout`** (opcional): grupos lado a lado, separados por uma divisória. Cada grupo é uma lista de linhas, e cada linha uma lista de índices de tubos.
- Tubos podem ter capacidades diferentes. Cada cor precisa caber inteira em pelo menos um tubo.

### Ferramenta de níveis

```bash
# valida o JSON e procura uma solução
node tools/tubos.mjs check levels/level-010.json

# embaralha um gabarito resolvido, garantindo que tem solução
node tools/tubos.mjs shuffle levels/bases/torres-5.json --seed 42 --id level-051 --name "Nível 51" > levels/level-051.json

# gera de novo os 50 níveis da campanha (a configuração fica no topo do arquivo)
node tools/tubos.mjs campaign
```

Para testar um arquivo no navegador, rode localmente e use `?level=`. Por segurança, isso só funciona em `localhost`:

```
http://localhost:8000/?level=levels/level-051.json
```

Se passar de 50 níveis, ajuste `LEVEL_COUNT` em `game.js` e `LEVELS` em `tools/tubos.mjs`.

---

## 🙏 Créditos

- Som do despejo: trecho de [“Pouring water bottles”](https://commons.wikimedia.org/wiki/File:Pouring_water_bottles.ogg), por *stephan*, em **domínio público** (Wikimedia Commons).
- Os demais sons são sintetizados em tempo real com a Web Audio API.
