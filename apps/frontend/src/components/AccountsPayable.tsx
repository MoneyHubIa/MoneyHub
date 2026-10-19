import React from 'react';
import {
  AccountsManager,
  CREATE_ACCOUNT_PAYABLE,
  DELETE_ACCOUNT_PAYABLE,
  MARK_ACCOUNT_PAYABLE_PAID,
  MY_ACCOUNTS_PAYABLE_QUERY,
  UPDATE_ACCOUNT_PAYABLE,
  type AccountPayableItem
} from './AccountsManager';

export {
  MY_ACCOUNTS_PAYABLE_QUERY,
  CREATE_ACCOUNT_PAYABLE,
  UPDATE_ACCOUNT_PAYABLE,
  MARK_ACCOUNT_PAYABLE_PAID,
  DELETE_ACCOUNT_PAYABLE,
  type AccountPayableItem
};

export function AccountsPayable(): React.JSX.Element {
  return <AccountsManager initialTab="PAYABLE" />;
}
