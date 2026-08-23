import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

/**
 * Muestra un cuadro de diálogo de confirmación personalizado.
 * Se integra automáticamente con el Light/Dark mode de la app mediante clases de CSS.
 * 
 * @param {string} text - El texto o pregunta a mostrar en el cuerpo.
 * @param {string} title - El título del modal.
 * @param {string} confirmText - Texto del botón de confirmar.
 * @param {string} cancelText - Texto del botón de cancelar.
 * @returns {Promise<boolean>} - true si el usuario confirmó, false en caso contrario.
 */
export const confirmAlert = async (
  text,
  title = '¿Estás seguro?',
  confirmText = 'Sí, continuar',
  cancelText = 'Cancelar',
  confirmBtnClass = 'btn btn-danger'
) => {
  const result = await MySwal.fire({
    title: title,
    text: text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true, // Pone el botón de confirmar a la derecha
    buttonsStyling: false,
    customClass: {
      popup: '!bg-[var(--bg-deep)] !border !border-[var(--border-soft)] !text-[var(--text-main)] !rounded-2xl !backdrop-blur-none',
      title: '!text-[var(--text-main)] !text-xl',
      htmlContainer: '!text-[var(--text-dim)]',
      actions: '!flex !gap-4 !w-full !justify-center !mt-6',
      confirmButton: confirmBtnClass,
      cancelButton: 'btn btn-outline-secondary'
    }
  });

  return result.isConfirmed;
};

/**
 * Muestra un modal de éxito simple.
 */
export const successAlert = async (text, title = '¡Éxito!') => {
  return MySwal.fire({
    title: title,
    text: text,
    icon: 'success',
    buttonsStyling: false,
    customClass: {
      popup: '!bg-[var(--bg-deep)] !border !border-[var(--border-soft)] !text-[var(--text-main)] !rounded-2xl !backdrop-blur-none',
      title: '!text-[var(--text-main)] !text-xl',
      htmlContainer: '!text-[var(--text-dim)]',
      actions: '!flex !gap-4 !w-full !justify-center !mt-6',
      confirmButton: 'btn btn-success'
    }
  });
};

/**
 * Muestra un modal de error simple.
 */
export const errorAlert = async (text, title = 'Error') => {
  return MySwal.fire({
    title: title,
    text: text,
    icon: 'error',
    buttonsStyling: false,
    customClass: {
      popup: '!bg-[var(--bg-deep)] !border !border-[var(--border-soft)] !text-[var(--text-main)] !rounded-2xl !backdrop-blur-none',
      title: '!text-[var(--text-main)] !text-xl',
      htmlContainer: '!text-[var(--text-dim)]',
      actions: '!flex !gap-4 !w-full !justify-center !mt-6',
      confirmButton: 'btn btn-danger'
    }
  });
};
