import Modal from './Modal.jsx';
import Button from './Button.jsx';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <div className="ui-confirm__body">
        {typeof message === 'string' ? <p className="ui-confirm__msg">{message}</p> : message}
      </div>
      <div className="ui-confirm__actions">
        <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
        <Button variant={variant} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
