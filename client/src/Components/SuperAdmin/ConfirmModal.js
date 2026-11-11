'use client';

import { Modal, Button } from 'react-bootstrap';

/**
 * Reusable Bootstrap confirm dialog.
 *
 * Props:
 *   show        – boolean, controls visibility
 *   title       – modal heading (default: "Confirm")
 *   message     – body text
 *   confirmLabel – confirm button text (default: "Delete")
 *   onConfirm   – called when user clicks confirm
 *   onCancel    – called when user clicks cancel or closes
 */
export default function ConfirmModal({
  show,
  title = 'Confirm',
  message = 'Are you sure?',
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}) {
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 16, fontWeight: 600 }}>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ fontSize: 14 }}>{message}</Modal.Body>
      <Modal.Footer>
        <Button variant="danger" size="sm" onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
