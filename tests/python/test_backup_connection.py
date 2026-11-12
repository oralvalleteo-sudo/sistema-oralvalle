import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('backup_connection', Path(__file__).parents[2] / 'scripts/backup_connection.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
BASE = 'postgresql://postgres.ldfhcaztdnoqjxtflmud:{}@aws-0-us-east-1.pooler.supabase.com:5432/postgres'


class BackupTests(unittest.TestCase):
    def test_decodes_password_once(self):
        self.assertEqual(m.connection_env(BASE.format('fake%40value%252F'))['PGPASSWORD'], 'fake@value%2F')

    def test_separate_password_needs_no_encoding(self):
        self.assertEqual(m.connection_env(BASE.format('[YOUR-PASSWORD]'), 'fake@/#%value')['PGPASSWORD'], 'fake@/#%value')

    def test_rejects_wrong_destinations_and_ambiguous_uri(self):
        for uri in [BASE.format(''), BASE.format('fake@value'), BASE.format('fake%value'), BASE.format('x').replace('5432', '6543'), BASE.format('x').replace('/postgres', '/wrong'), BASE.format('x').replace('postgres.ldfhcaztdnoqjxtflmud:', 'postgres:')]:
            with self.assertRaises(m.ConnectionError):
                m.connection_env(uri)

    def test_password_never_in_command_or_output(self):
        password = 'synthetic-secret@/#%'
        with patch.dict(m.os.environ, {'DATABASE_URL': BASE.format('[YOUR-PASSWORD]'), 'DATABASE_PASSWORD': password, 'RUNNER_TEMP': '/tmp'}), patch.object(m.sys, 'argv', ['backup_connection.py']), patch.object(m.subprocess, 'run', return_value=SimpleNamespace(returncode=1, stderr='password authentication failed ' + password)) as run, patch('builtins.print') as output:
            self.assertEqual(m.main(), 1)
            self.assertNotIn(password, str(run.call_args.args))
            self.assertEqual(run.call_args.kwargs['env']['PGPASSWORD'], password)
            self.assertNotIn(password, str(output.call_args_list))


if __name__ == '__main__':
    unittest.main()
