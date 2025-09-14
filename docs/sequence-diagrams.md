# Sequence Diagrams

## User Registration and Login Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API Server
    participant DB as Database
    participant W as Wallet

    Note over U,W: User Registration/Login Flow
    U->>F: Connect Wallet
    F->>W: Request Account Access
    W-->>F: Wallet Address
    F->>A: POST /auth/login {wallet_address}
    A->>A: Generate Challenge Message
    A-->>F: Challenge Message
    F->>W: Request Signature
    W-->>F: Signed Message
    F->>A: POST /auth/login {wallet_address, signature}
    A->>A: Verify Signature
    A->>DB: Create/Update User Session
    DB-->>A: User Data
    A->>A: Generate JWT Token
    A-->>F: {success: true, token, user}
    F-->>U: Login Success
```

## Proof Creation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant E as Chrome Extension
    participant F as Frontend
    participant A as API Server
    participant V as Verification Service
    participant R as Reclaim Protocol
    participant DB as Database

    Note over U,DB: Proof Creation Flow
    U->>E: Click "Generate Proof"
    E->>E: Extract Website Data
    E->>F: Send Proof Data
    F->>A: POST /proofs {title, description, provider, proof_data}
    A->>A: Validate Request
    A->>DB: Create Proof Record (status: pending)
    DB-->>A: Proof ID
    A->>V: Process Proof Data
    V->>R: Submit Proof for Verification

    Note over R: Reclaim Protocol Processing
    R->>R: Generate ZK Proof
    R-->>V: Verification Result

    V->>DB: Update Proof Status
    V->>A: Verification Complete
    A-->>F: {success: true, proof}
    F-->>U: Proof Created Successfully
```

## Proof Verification Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API Server
    participant V as Verification Service
    participant R as Reclaim Protocol
    participant BC as Blockchain
    participant DB as Database

    Note over U,DB: Proof Verification Flow
    U->>F: Request Proof Verification
    F->>A: POST /proofs/{id}/verify
    A->>V: Start Verification Process
    V->>R: Verify Proof with Reclaim

    par Reclaim Verification
        R->>R: Validate ZK Proof
        R-->>V: Verification Status
    and Blockchain Verification (Optional)
        V->>BC: Submit to Smart Contract
        BC-->>V: On-chain Verification Result
    end

    V->>DB: Create Verification Record
    V->>DB: Update Proof Status
    V-->>A: Verification Results
    A-->>F: Verification Response
    F-->>U: Show Verification Status
```

## Data Synchronization Flow

```mermaid
sequenceDiagram
    participant E as Chrome Extension
    participant F as Frontend
    participant A as API Server
    participant WS as WebSocket Server
    participant DB as Database

    Note over E,DB: Real-time Data Synchronization
    F->>WS: Connect WebSocket
    WS-->>F: Connection Established

    E->>A: POST /proofs (New Proof)
    A->>DB: Store Proof
    A->>WS: Broadcast Update
    WS->>F: Real-time Update
    F->>F: Update UI

    Note over F: User sees instant updates
```

## Error Handling Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API Server
    participant V as Verification Service
    participant R as Reclaim Protocol
    participant DB as Database

    Note over U,DB: Error Handling Scenarios
    U->>F: Submit Proof
    F->>A: POST /proofs
    A->>V: Process Proof
    V->>R: Submit for Verification

    alt Reclaim Service Error
        R-->>V: Error Response
        V->>DB: Update Proof Status (failed)
        V-->>A: Verification Failed
        A-->>F: {success: false, error}
        F-->>U: Show Error Message
    else Network Timeout
        R--xV: Timeout
        V->>DB: Update Proof Status (pending_retry)
        V->>V: Schedule Retry
        V-->>A: Temporary Failure
        A-->>F: {success: false, retry_scheduled}
        F-->>U: "Verification in progress..."
    else Invalid Proof Data
        V->>V: Validate Proof Data
        V-->>A: Invalid Data Error
        A-->>F: {success: false, validation_error}
        F-->>U: Show Validation Errors
    end
```

## Multi-Device Synchronization

```mermaid
sequenceDiagram
    participant D1 as Device 1 (Extension)
    participant D2 as Device 2 (Web App)
    participant A as API Server
    participant WS as WebSocket Server
    participant DB as Database

    Note over D1,DB: Cross-Device Proof Sync
    D1->>A: POST /proofs (Create Proof)
    A->>DB: Store Proof
    DB-->>A: Proof Stored
    A->>WS: Broadcast to User Sessions

    par Notify Device 2
        WS->>D2: New Proof Event
        D2->>D2: Update Proof List
    and Confirm Device 1
        A-->>D1: Proof Created
        D1->>D1: Update Local State
    end

    Note over D2: User sees proof from extension
    Note over D1: Extension shows confirmation
```

## Batch Processing Flow

```mermaid
sequenceDiagram
    participant S as Scheduler
    participant BP as Batch Processor
    participant DB as Database
    participant R as Reclaim Protocol
    participant N as Notification Service

    Note over S,N: Background Batch Processing
    S->>BP: Trigger Batch Job
    BP->>DB: Query Pending Proofs
    DB-->>BP: List of Proofs

    loop For Each Proof
        BP->>R: Submit Verification
        R-->>BP: Result
        BP->>DB: Update Proof Status

        alt Verification Success
            BP->>N: Send Success Notification
        else Verification Failed
            BP->>N: Send Failure Notification
        end
    end

    BP->>DB: Update Batch Job Status
    BP-->>S: Batch Complete
```