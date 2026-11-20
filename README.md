# teste-neon

Repositório de teste para desenvolvimento sincronizado entre 2 computadores usando Git e GitHub.

## Como baixar no segundo PC

1. Instale o Git e o GitHub CLI (`gh`) no Windows (sem precisar de permissão de administrador):
   ```powershell
   winget install --id Git.MinGit -e --scope user
   winget install --id GitHub.cli -e --scope user
   ```
2. Abra um novo terminal e conecte sua conta do GitHub:
   ```powershell
   gh auth login
   gh auth setup-git
   ```
3. Baixe o repositório para uma pasta no segundo PC:
   ```powershell
   git clone https://github.com/Kimijoao77/teste-neon.git
   ```
4. Abra a pasta `teste-neon` no Antigravity.

## Fluxo diário

- **Antes de começar em qualquer PC:**
  ```powershell
  git pull
  ```
- **Ao terminar de trabalhar:**
  ```powershell
  git add .
  git commit -m "resumo das alterações"
  git push
  ```
