# Relatório Técnico: Gap de Dados NDVI na API de Monitoramento

**Data:** 03/02/2026  
**Reportado por:** Equipe Logistic Monitor  
**Endpoint afetado:** `POST /consulta-ndvi`

---

## Resumo Executivo

Identificamos que o endpoint `/consulta-ndvi` não está retornando dados interpolados até a data solicitada (`end_date`). A API retorna dados apenas até a última passagem efetiva do satélite, sem extrapolar ou interpolar para datas futuras.

---

## Comportamento Observado

### Chamada realizada:

```bash
curl -X POST "https://homolog.api.merx.tech/api/monitoramento/consulta-ndvi" \
  -F "arquivo=@talhao.geojson" \
  -F "start_date=2026-01-01" \
  -F "end_date=2026-02-03"
```

### Resposta recebida:

| Parâmetro | Valor |
|-----------|-------|
| Período solicitado | 2026-01-01 a 2026-02-03 (34 dias) |
| Dias retornados | 17 dias |
| Última data na resposta | 2026-01-17 |
| Dias faltando | 17 dias |

### Dados retornados (amostra):

```json
{
  "talhao_0": [
    { "date": "2026-01-01", "ndvi_smooth": 0.923, "ndvi_interp": 0.923 },
    { "date": "2026-01-02", "ndvi_smooth": 0.932, "ndvi_interp": 0.932 },
    ...
    { "date": "2026-01-17", "ndvi_smooth": 0.894, "ndvi_interp": 0.894 }
    // Dados param aqui, mesmo com end_date=2026-02-03
  ]
}
```

---

## Comportamento Esperado (conforme documentação)

A documentação da API indica:

> **POST /consulta-ndvi** - "Valores **diários** de NDVI"

Com base nisso, esperamos que a API retorne dados para **todos os dias** no intervalo `start_date` até `end_date`, utilizando:

1. **Dados reais** quando há passagem do satélite
2. **Dados interpolados** (`ndvi_interp`) para dias entre passagens
3. **Dados suavizados** (`ndvi_smooth`) para toda a série

---

## Análise Técnica

### O que funciona:
- ✅ Interpolação entre passagens do satélite (01/01 a 17/01 são diários)
- ✅ Campos `ndvi_smooth` e `ndvi_interp` populados corretamente
- ✅ Sem gaps dentro do período coberto

### O que não funciona:
- ❌ Dados param na última passagem do satélite (17/01)
- ❌ Não há extrapolação/interpolação para datas futuras até `end_date`
- ❌ API ignora silenciosamente o `end_date` quando não há dados

---

## Impacto

### Regiões afetadas:
| Região | Gap observado | Causa provável |
|--------|---------------|----------------|
| Mato Grosso (Santa Rita do Trivelato) | 14-17 dias | Cobertura de nuvens |
| Paraná (Guarapuava) | 3 dias | Normal |

### Impacto no produto:
- Gráficos de NDVI mostram dados apenas até a última passagem do satélite
- Usuários não têm visibilidade do comportamento recente da cultura
- Projeções e análises logísticas ficam desatualizadas

---

## Perguntas para a Equipe Merx

1. **Este comportamento é intencional?**
   - A API foi projetada para não extrapolar dados para o futuro?

2. **Existe parâmetro para forçar interpolação?**
   - Há algum parâmetro adicional que podemos passar para obter dados até `end_date`?

3. **Qual a causa do gap de 17 dias no Mato Grosso?**
   - É cobertura de nuvens ou problema no pipeline de processamento?

4. **Existe previsão de dados para a região?**
   - Quando podemos esperar novos dados NDVI para Santa Rita do Trivelato/MT?

---

## Dados para Reprodução

### Talhão de teste:
- **ID:** cmkzn8hbt0000ylnidmalbjyg
- **Nome:** Talhão 01
- **Localização:** Santa Rita do Trivelato/MT
- **Área:** 263 ha

### GeoJSON do talhão:
Disponível mediante solicitação.

### Datas testadas:
- `start_date`: 2026-01-01
- `end_date`: 2026-02-03
- Última data retornada: 2026-01-17

---

## Sugestões

### Opção 1: Interpolação até `end_date`
A API poderia continuar a interpolação/extrapolação até a data solicitada, usando:
- Tendência dos últimos N dias
- Modelo de suavização exponencial
- Ou simplesmente repetir o último valor conhecido

### Opção 2: Retornar flag indicando "dados incompletos"
```json
{
  "talhao_0": [...],
  "metadata": {
    "requested_end_date": "2026-02-03",
    "actual_end_date": "2026-01-17",
    "gap_days": 17,
    "reason": "cloud_coverage"
  }
}
```

### Opção 3: Documentar comportamento atual
Se o comportamento atual é intencional, sugerimos atualizar a documentação para refletir que os dados retornados dependem da disponibilidade de imagens de satélite.

---

## Contato

Para discussão técnica adicional, estamos disponíveis para call ou troca de mensagens.

**Equipe Logistic Monitor**
