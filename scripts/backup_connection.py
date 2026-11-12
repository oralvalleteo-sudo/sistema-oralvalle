"""Validate the intended database and run pg_dump without credentials in argv/logs."""
import os
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit


class ConnectionError(ValueError):
    pass


def connection_env(uri, password_override=''):
    try:
        parsed = urlsplit(uri.strip().replace('[YOUR-PASSWORD]', ''))
        host, port = parsed.hostname, parsed.port
    except ValueError:
        raise ConnectionError('Formato da conexão inválido. Copie a URI do Session pooler.') from None
    if parsed.scheme not in ('postgresql', 'postgres'):
        raise ConnectionError('A conexão deve começar com postgresql://.')
    if host != 'aws-0-us-east-1.pooler.supabase.com' or port != 5432:
        raise ConnectionError('Use o Session pooler do projeto esperado, porta 5432.')
    if unquote(parsed.username or '') != 'postgres.ldfhcaztdnoqjxtflmud':
        raise ConnectionError('Usuário incorreto: preserve o usuário completo do Session pooler.')
    if parsed.path != '/postgres' or parsed.fragment:
        raise ConnectionError('Conexão malformada. Caracteres da senha podem ter alterado o endereço.')
    # An optional separate secret avoids manually encoding passwords in a URI.
    if password_override:
        password = password_override
    else:
        raw = parsed.password or ''
        if '@' in raw or re.search(r'%(?![0-9a-fA-F]{2})', raw):
            raise ConnectionError('Senha ambígua na URI. Configure SUPABASE_DB_PASSWORD com a senha original.')
        password = unquote(raw)
    if not password or password in ('[YOUR-PASSWORD]', 'YOUR-PASSWORD'):
        raise ConnectionError('Falta a senha do banco. Configure SUPABASE_DB_PASSWORD.')
    if any(c in password for c in ('\x00', '\r', '\n')):
        raise ConnectionError('A senha contém quebra de linha ou caractere inválido. Confira o segredo.')
    return dict(PGHOST=host, PGPORT=str(port), PGUSER=unquote(parsed.username),
                PGDATABASE='postgres', PGPASSWORD=password, PGSSLMODE='require',
                PGCONNECT_TIMEOUT='20')


def failure_message(stderr):
    text = stderr.lower()
    if 'password authentication failed' in text or 'authentication failed' in text:
        return ('O servidor recusou a autenticação. A conexão foi enviada sem depender da codificação da URI. '
                'Confira SUPABASE_DB_PASSWORD: use a senha ATUAL do banco deste projeto, sem codificação e sem colchetes. '
                'Chaves de API não servem. Se a senha atual for desconhecida, redefina-a no Supabase e atualize as conexões que a utilizam.')
    if 'server version' in text and 'pg_dump version' in text:
        return 'A versão do pg_dump é incompatível com a versão do servidor.'
    if any(term in text for term in ('timeout', 'could not translate host', 'connection refused', 'network is unreachable')):
        return 'Falha de rede ao conectar ao banco. Confira o estado do projeto e as restrições de rede no Supabase.'
    return 'A exportação falhou. Nenhum backup foi publicado. O diagnóstico bruto foi omitido para proteger credenciais.'


def main():
    try:
        env = connection_env(os.environ.get('DATABASE_URL', ''), os.environ.get('DATABASE_PASSWORD', ''))
    except ConnectionError as error:
        print(str(error), file=sys.stderr)
        return 1
    if '--check' in sys.argv:
        print('Formato e destino confirmados. A senha ainda será validada pelo servidor.')
        return 0
    command = ['docker', 'run', '--rm']
    for name in env:
        command += ['--env', name]
    command += ['--volume', os.environ['RUNNER_TEMP'] + '/backup:/backup',
                'postgres:17', 'pg_dump', '--format=custom', '--no-owner', '--no-acl',
                '--file=/backup/oralvalle.dump']
    # Pass secrets through the environment, never as command arguments.
    result = subprocess.run(command, env={**os.environ, **env}, capture_output=True, text=True)
    if result.returncode:
        print(failure_message(result.stderr), file=sys.stderr)
        return 1
    print('Exportação concluída.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
