# Criptografia em Repouso e HTTPS (TLS)

Referência prática e didática sobre proteção de dados armazenados (criptografia simétrica/assimétrica) e proteção em trânsito (HTTPS).

---

## 1. Criptografia Simétrica Autenticada (AES-256-GCM)

Quando a aplicação precisa **guardar e depois recuperar** um dado sensível (ex.: chave Pix para o admin fazer repasse, ou CPF para exibir mascarado):

- **Use AEAD (*Authenticated Encryption with Associated Data*):** `AES-256-GCM` garante **confidencialidade** (ninguém lê sem a chave) e **integridade** (se alguém alterar 1 bit no banco, a descriptografia falha imediatamente pela *Auth Tag*).
- **Evite AES-ECB e AES-CBC sem HMAC:** `ECB` vaza padrões dos dados; `CBC` puro não detecta adulteração (*padding oracle*).

### Anatomia do dado cifrado
Guarde junto tudo o que é necessário para abrir o dado (com versão de chave para suportar rotação):
```text
v1:<iv_base64url>:<authTag_base64url>:<ciphertext_base64url>
```
- **Chave:** exatamente 32 bytes (256 bits), gerada com `crypto.randomBytes(32)`.
- **IV / Nonce:** 12 bytes aleatórios (`crypto.randomBytes(12)`) gerados **a cada nova cifragem**.
  > **Regra crítica:** repetir `(chave, IV)` no AES-GCM destrói a confidencialidade e permite forjar a autenticação!
- **AAD (Associated Data) opcional:** vincular o `usuarioId` como dado associado impede mover um campo cifrado de uma linha/conta para outra no banco sem que a verificação falhe.

### Falha de chave / rotação
- Se a chave de criptografia mudar em produção sem re-cifrar os registros antigos, registre claramente o erro sem derrubar o servidor inteiro (ex.: marcar o dado como indisponível para o usuário recadastrar, sem vazar detalhes técnicos).
- Em produção com banco persistente, **nunca** gere chave temporária em memória na inicialização: falhe na subida (*fail fast*) se a variável obrigatória estiver ausente.

---

## 2. Simétrica vs Assimétrica (e como o HTTPS funciona)

| Tipo | Chaves | Desempenho | Uso principal |
| --- | --- | --- | --- |
| **Simétrica** (`AES-256-GCM`) | Mesma chave cifra e decifra | Muito rápida | Dados no banco, tráfego da sessão TLS |
| **Assimétrica** (`RSA`, `ECDSA`, `Ed25519`, `ECDH`) | Par pública + privada | Mais lenta | Certificados TLS, assinatura de JWT (RS256/EdDSA), troca inicial de chave |

### O que acontece no handshake HTTPS (TLS 1.3)?
1. O servidor envia seu **certificado digital** (assinado por uma Autoridade Certificadora confiável) provando a identidade do domínio.
2. Cliente e servidor executam uma troca de chaves assimétrica efêmera (**ECDHE**), garantindo *Forward Secrecy* (mesmo se a chave privada vazar no futuro, tráfego gravado no passado continua ilegível).
3. Ambos derivam uma **chave simétrica de sessão** (`AES-GCM` ou `ChaCha20-Poly1305`) e todo o HTTP (URL, headers, cookies, corpo JSON) passa a trafegar cifrado e autenticado.

---

## 3. Boas práticas de HTTPS e Gestão de Segredos

- **TLS obrigatório em produção:** redirecione `http://` para `https://`, ative **HSTS** apenas em produção HTTPS e exija `https:` nas URLs de APIs externas/storage.
- **Proxy reverso (`trust proxy`):** atrás de Nginx/Cloudflare/Render, configure o app para confiar apenas nos saltos esperados (ou `loopback`) para ler `X-Forwarded-Proto` e IP real sem aceitar spoofing direto do cliente.
- **Segredos em desenvolvimento vs produção:**
  - Dev: `.env` local (ignorado no `.gitignore`), nunca versionado.
  - Produção: variáveis de ambiente seguras do provedor ou cofre de segredos (KMS / Secrets Manager).
  - CI: scanner automático de segredos (ex.: `gitleaks`) para barrar commits acidentais.
