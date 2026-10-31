# Camila Run — Pixel Parkour (v1.0)

Jogo de parkour 2D com sprites em pixel art extraídos da imagem fornecida. Funciona em HTML, CSS e JavaScript puro, sem servidor, inclusive no GitHub Pages.

## Como jogar
1. Abra `index.html` no navegador ou inicie um servidor estático no Codespaces com `python3 -m http.server 8000`.
2. Digite um nick (2 a 14 caracteres).
3. Clique em **COMEÇAR A CORRER** e tente superar seu recorde.

## Controles
- **Espaço**, **↑** ou **W**: pular (salto duplo)
- **↓** ou **S**: deslizar ou queda rápida
- **Shift** ou **X**: impulso veloz
- **P** ou **Esc**: pausar
- Celular: botões na tela

## Ranking
O TOP 10 mostra o melhor resultado por nick e armazena os dados com `localStorage` **neste navegador/dispositivo**. Um ranking global entre todos os jogadores precisaria de um backend e banco de dados seguros.

## Conteúdo
- Sprites reais da Camila (parada, dois quadros de corrida, pulo, deslize, queda) e XIS (parado, corrida, pulo, deslize, queda)
- Cidade noturna com prédios, lua, luzes neon e plataforma
- Sistema de três vidas, obstáculos, cristais, dash, salto duplo e pausa
- Tela para inserir nick, iniciar, reiniciar e consultar o TOP 10
- Controles para desktop e celular

**Nota:** Projeto de fã não oficial, sem vínculo ou endosso das pessoas retratadas. Os sprites foram criados a partir da imagem fornecida pelo usuário.