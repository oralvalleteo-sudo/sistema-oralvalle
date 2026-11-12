/* Termos só são apresentados para aceite quando a versão estiver publicada e aprovada. */
(()=>{'use strict';const terms=window.NexoLegalConfig?.accountTerms;
const active=()=>terms?.published===true;
function metadata(checked){if(!active())return undefined;if(!checked)throw Error('Leia e aceite os termos de uso para cadastrar a conta.');return {document:terms.id,version:terms.version,sha256:terms.sha256};}
window.NexoLegalAcceptance={active,metadata};
})();
