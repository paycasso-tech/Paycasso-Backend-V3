export declare class EmailService {
    private transporter;
    private readonly logger;
    constructor();
    private initializeTransporter;
    sendVerificationEmail(email: string, otp: string): Promise<void>;
    sendPasswordResetEmail(email: string, otp: string): Promise<void>;
    private sendMail;
}
