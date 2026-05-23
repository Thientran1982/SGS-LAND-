# MEMORY.md — SGS LAND AI Memory Architecture v1.0

## Tier 1: Core Memory (Always in Context)
Persistent facts loaded vào mỗi system prompt:
- Agent identity từ SGSLAND_SOUL.md
- Project database (11+ dự án, giá, pháp lý)
- Hotline, CTA scripts

## Tier 2: Session Memory (Per Conversation)
Lưu trong DB theo sessionId:
- userName, userPhone (từ registration)
- conversationHistory (messages array, tối đa 20 turns)
- userProfile được extract: { budget, district, purpose, timeline }
- intentHistory: array các intent đã detect

## Tier 3: User Profile Memory (Persistent)
Lưu trong leads table, cập nhật sau mỗi session:
- Lần ghé thăm, projects đã xem
- Budget range đã đề cập
- Preferred districts
- Purchase timeline
- Lead score
