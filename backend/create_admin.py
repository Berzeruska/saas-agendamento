"""
Uso: python create_admin.py <tenant_slug> <usuario> <senha>
Cria ou atualiza o administrador de um tenant específico.
"""
import sys
import bcrypt
from database import get_db

if len(sys.argv) != 4:
    print("Uso: python create_admin.py <tenant_slug> <usuario> <senha>")
    sys.exit(1)

tenant_slug = sys.argv[1].strip()
usuario = sys.argv[2].strip()
senha = sys.argv[3]

if len(senha) < 8:
    print("ERRO: Senha deve ter no mínimo 8 caracteres")
    sys.exit(1)

db = get_db()

tenant = db.table("tenants").select("id, nome").eq("slug", tenant_slug).maybe_single().execute()
if not tenant or not tenant.data:
    print(f"ERRO: Tenant '{tenant_slug}' não encontrado. Crie o tenant primeiro.")
    sys.exit(1)

tenant_id = tenant.data["id"]
tenant_nome = tenant.data["nome"]

senha_hash = bcrypt.hashpw(senha.encode(), bcrypt.gensalt(rounds=12)).decode()

existente = db.table("admin").select("id").eq("usuario", usuario).eq("tenant_id", tenant_id).maybe_single().execute()
if existente and existente.data:
    db.table("admin").update({"senha_hash": senha_hash}).eq("usuario", usuario).eq("tenant_id", tenant_id).execute()
    print(f"Admin '{usuario}' do tenant '{tenant_nome}' atualizado com sucesso.")
else:
    db.table("admin").insert({"tenant_id": tenant_id, "usuario": usuario, "senha_hash": senha_hash}).execute()
    print(f"Admin '{usuario}' criado para o tenant '{tenant_nome}' ({tenant_slug}).")
