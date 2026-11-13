"""Regression checks use synthetic rows; never connect to the clinic database."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).parents[2] / 'scripts'
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location('backup_clinics', SCRIPTS / 'backup_clinics.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
BASE = 'postgresql://postgres.ldfhcaztdnoqjxtflmud:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres'
CLINIC = '11111111-1111-1111-1111-111111111111'


class Cursor:
    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def execute(self, query, args=None):
        self.query = str(query)
        self.args = args

    def fetchall(self):
        if 'SELECT id::text' in self.query:
            return [(CLINIC, 'Clínica sintética')]
        if 'information_schema.columns' in self.query:
            return [('public', 'patients')]
        if self.args != (CLINIC,):
            raise AssertionError('Exportação sem filtro de clínica')
        return [({'clinic_id': CLINIC, 'id': 'paciente-ficticio'},)]

    def fetchone(self):
        return ({'id': CLINIC, 'nome': 'Clínica sintética'},)


class Connection:
    def __init__(self):
        self.statements = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def cursor(self, **kwargs):
        return Cursor()

    def execute(self, query):
        self.statements.append(query)

    def transaction(self):
        return contextlib.nullcontext()


class ClinicBackupTests(unittest.TestCase):
    def test_separate_password_and_tls_reach_driver_without_uri(self):
        with patch.object(m, 'DATABASE_URL', BASE), patch.dict(os.environ, {'DATABASE_PASSWORD': 'synthetic@/#%'}):
            opts = m.connection_options()
        self.assertEqual(opts['password'], 'synthetic@/#%')
        self.assertEqual(opts['sslmode'], 'require')
        self.assertEqual(opts['user'], 'postgres.ldfhcaztdnoqjxtflmud')
        self.assertNotIn('conninfo', opts)

    def test_existing_backups_and_symlink_targets_are_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp) / 'previous'
            directory.mkdir()
            saved = directory / 'previous.json.age'
            saved.write_bytes(b'previous encrypted backup')
            with self.assertRaises(ValueError):
                m.prepare_output(directory)
            self.assertEqual(saved.read_bytes(), b'previous encrypted backup')
            link = Path(tmp) / 'link'
            link.symlink_to(directory, target_is_directory=True)
            with self.assertRaises(ValueError):
                m.prepare_output(link)
            self.assertTrue(saved.exists())

    def check_export(self, encryption_fails=False):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp) / 'output'
            conn = Connection()

            def encrypt(command, **kwargs):
                plain = Path(command[-1])
                self.assertEqual(stat.S_IMODE(plain.stat().st_mode), 0o600)
                self.assertEqual(stat.S_IMODE(directory.stat().st_mode), 0o700)
                payload = json.loads(plain.read_text())
                self.assertEqual(payload['clinic_id'], CLINIC)
                self.assertEqual(payload['tables']['public.patients'][0]['clinic_id'], CLINIC)
                self.assertEqual(kwargs['stderr'], subprocess.PIPE)
                if encryption_fails:
                    raise subprocess.CalledProcessError(1, command, stderr=b'synthetic-secret')
                # Fake output tests packaging only, not cryptographic validity.
                Path(command[command.index('-o') + 1]).write_bytes(b'synthetic-encrypted-output')

            logs = io.StringIO()
            with patch.object(m, 'DATABASE_URL', BASE), patch.object(m, 'AGE_RECIPIENT', 'age1synthetic'), patch.object(m, 'OUT_DIR', directory), patch.dict(os.environ, {'DATABASE_PASSWORD': 'synthetic-secret'}), patch.object(m, 'shutil_which', return_value='/fake/age'), patch.object(m.psycopg, 'connect', return_value=conn) as connect, patch.object(m.subprocess, 'run', side_effect=encrypt), contextlib.redirect_stdout(logs), contextlib.redirect_stderr(logs):
                result = m.run()
            self.assertEqual(result, 1 if encryption_fails else 0)
            self.assertFalse(list(directory.glob('*.json')))
            self.assertNotIn('synthetic-secret', logs.getvalue())
            self.assertNotIn('Clínica sintética', logs.getvalue())
            self.assertEqual(connect.call_args.kwargs['password'], 'synthetic-secret')
            self.assertIn('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY', conn.statements)
            self.assertIn('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ', conn.statements)
            if not encryption_fails:
                self.assertEqual(len(list(directory.glob('*.json.age'))), 1)

    def test_success_uses_private_plaintext_and_removes_it(self):
        self.check_export()

    def test_encryption_failure_removes_plaintext_and_hides_stderr(self):
        self.check_export(encryption_fails=True)

    def test_driver_error_never_prints_credentials_or_connection(self):
        secret = 'synthetic-secret@/#%'
        logs = io.StringIO()
        with patch.object(m, 'main', side_effect=RuntimeError('connection ' + BASE + secret)), contextlib.redirect_stderr(logs):
            self.assertEqual(m.run(), 1)
        self.assertNotIn(secret, logs.getvalue())
        self.assertNotIn(BASE, logs.getvalue())


if __name__ == '__main__':
    unittest.main()
