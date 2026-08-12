import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const headers = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
void url;
void headers;
// probar que clave_origen sea realmente unique: insertar dos con misma clave y ver si falla la segunda
