# Gestão de Segredos

Referência prática e didática para armazenar, validar, rotacionar e proteger credenciais e chaves em todo o ciclo de vida do software.

---

## 1. O que é segredo vs configuração pública

| Tipo | Exemplos | Onde pode existir |
| --- | --- | --- |
| **Segredo** | `DATABASE_URL` (com senha), `JWT_SECRET`, `CPF_CRIPTO_CHAVE`, `PIX_CRIPTO_CHAVE`, `SUPABASE_SECRET_KEY`, `API_KEYS`, token de webhook/gateway | **Somente no servidor** (variáveis de ambiente seguras / cofre de segredos) |
| **Configuração pública** | `PORT`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_URL` (host público do projeto, nunca a chave secreta) | Servidor e, quando necessário, build do front-end |

> **Regra no Next.js / Vite:** qualquer variável `NEXT_PUBLIC_*` (ou `VITE_*`) é embutida em texto claro no JavaScript enviado ao navegador. **Nunca** coloque chaves privadas ou API keys internas ali.

---

## 2. Segredos por ambiente (Dev, CI, Produção)

### Desenvolvimento local
- Guarde em `.env` na raiz (listado no `.gitignore`).
- Mantenha um `.env.example` **versionado** apenas com nomes das variáveis, comentários e valores fictícios/vazios (ou instruções de geração).
- Scripts de conveniência (ex.: `npm run gerar-env`) podem gerar chaves aleatórias locais com `crypto.randomBytes(32)` para não usar senhas fixas fáceis.

### CI/CD (GitHub Actions)
- Use *Secrets* do repositório/ambiente apenas para os jobs que realmente precisam (ex.: deploy).
- Nos testes automatizados na CI, use banco efêmero de teste e chaves descartáveis geradas em tempo de execução — nunca credenciais de produção.

### Produção
- Configure no painel de secrets do provedor (Render, AWS Secrets Manager, Vault, etc.) com `sync: false` em arquivos de infraestrutura como código (`render.yaml`).
- **Fail fast obrigatório:** na subida do processo em `NODE_ENV === "production"`, valide todas as variáveis obrigatórias (presença, comprimento mínimo, formato URL HTTPS) e **encerre o processo com erro** se alguma estiver faltando ou inválida. Nunca caia para um segredo padrão hardcoded como `"segredo-dev"`.

---

## 3. Boas práticas operacionais

1. **Princípio de isolamento por finalidade:**
   - Use chaves independentes para cada função (ex.: `JWT_SECRET` separado de `CPF_HASH_CHAVE` e `PIX_CRIPTO_CHAVE`). Se uma vazar ou precisar girar, as outras continuam íntegras.
2. **Entropia adequada:**
   - Gere segredos simétricos com pelo menos 256 bits (`crypto.randomBytes(32).toString("base64url")`), nunca frases previsíveis.
3. **Nunca logue segredos:**
   - Cuidado com `console.log(process.env)`, `console.log(req.headers)` (expõe `Authorization` e `Cookie`) ou logs de erro HTTP contendo a URL completa quando a URL traz token/senha (ex.: `DATABASE_URL`).
4. **Rotação de chaves:**
   - Tokens JWT curtos (ex.: 15 min) facilitam rotação.
   - Dados cifrados em banco devem carregar versão (`v1:...`) para permitir decifrar com a chave antiga e re-cifrar com a nova durante a rotação.

---

## 4. Detecção e resposta a vazamento (`gitleaks`)

- **Prevenção:** rode `gitleaks` no hook local e obrigatoriamente na CI a cada push/PR.
- **Falsos positivos:** só adicione em `.gitleaksignore` após confirmar que é um dado puramente fictício de teste (e nunca uma credencial real).
- **Se um segredo real foi commitado (mesmo em branch privada ou apagado no commit seguinte):**
  1. **Considere comprometido imediatamente.**
  2. **Revogue e gere novo segredo** no provedor (banco, AWS/Supabase, gateway Pix, JWT) antes de qualquer outra coisa.
  3. Remova do repositório e limpe o histórico se necessário, sabendo que a rotação é o que realmente neutraliza o risco.
