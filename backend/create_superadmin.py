"""
Uso: python create_superadmin.py <usuario> <senha>
Cria ou atualiza o superadmin global.
"""
import sys
import bcrypt
from database import get_db

if len(sys.argv) != 3:
    print("Uso: python create_superadmin.py <usuario> <senha>")
    sys.exit(1)

usuario = sys.argv[1].strip()
senha = sys.argv[2]

if len(senha) < 12:
    print("ERRO: Senha do superadmin deve ter no mínimo 12 caracteres")
    sys.exit(1)

senha_hash = bcrypt.hashpw(senha.encode(), bcrypt.gensalt(rounds=12)).decode()
db = get_db()

existente = db.table("superadmin").select("id").eq("usuario", usuario).maybe_single().execute()
if existente and existente.data:
    db.table("superadmin").update({"senha_hash": senha_hash}).eq("usuario", usuario).execute()
    print(f"Superadmin '{usuario}' atualizado.")
else:
    db.table("superadmin").insert({"usuario": usuario, "senha_hash": senha_hash}).execute()
    print(f"Superadmin '{usuario}' criado.")
