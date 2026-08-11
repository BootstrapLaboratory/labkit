/**
 * @generated SignedSource<<7a08d9bc5d69bfdd14c67be549b8f74c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type LifecyclePrimaryQuery$variables = {
  id: string;
};
export type LifecyclePrimaryQuery$data = {
  readonly item: {
    readonly id: string;
    readonly label: string;
  };
};
export type LifecyclePrimaryQuery = {
  response: LifecyclePrimaryQuery$data;
  variables: LifecyclePrimaryQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      }
    ],
    "concreteType": "Item",
    "kind": "LinkedField",
    "name": "item",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "label",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "LifecyclePrimaryQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "LifecyclePrimaryQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "017e84f6fd195fb65295eb24258ab2ee",
    "id": null,
    "metadata": {},
    "name": "LifecyclePrimaryQuery",
    "operationKind": "query",
    "text": "query LifecyclePrimaryQuery(\n  $id: ID!\n) {\n  item(id: $id) {\n    id\n    label\n  }\n}\n"
  }
};
})();

(node as any).hash = "e62bed6d2ae4c0c0055ff6e1d0b9717b";

export default node;
