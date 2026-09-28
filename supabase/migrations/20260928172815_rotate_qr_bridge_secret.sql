update public.integration_secrets
set secret_hash = 'aba1696da761e389739d6934d61fd42d5ba4adcd49f5565825b49fa8fe3a52c8',
    updated_at = now()
where name = 'qr_bridge';
