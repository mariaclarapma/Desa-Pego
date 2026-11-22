#!/usr/bin/env bash
# Gera os SVGs de todos os diagramas UML do Desa Pego a partir dos .puml.
# Requisitos: Java 11+ e PlantUML (ex.: `brew install plantuml` ou o plantuml.jar).
# Uso: ./docs/uml/gerar-diagramas.sh            -> SVG ao lado de cada .puml
#      FORMATO=png ./docs/uml/gerar-diagramas.sh -> PNG
set -euo pipefail
cd "$(dirname "$0")"
FORMATO="${FORMATO:-svg}"
PLANTUML="${PLANTUML:-plantuml}"   # ou: PLANTUML="java -jar /caminho/plantuml.jar"

ARQUIVOS=(casos-de-uso/*.puml classes/*.puml sequencia/*.puml componentes/*.puml implantacao/*.puml padroes/*.puml)

echo "Validando sintaxe de ${#ARQUIVOS[@]} diagramas..."
$PLANTUML -checkonly -failfast2 "${ARQUIVOS[@]}"

echo "Gerando ${FORMATO}..."
$PLANTUML -t"$FORMATO" -charset UTF-8 "${ARQUIVOS[@]}"
echo "Concluído."
