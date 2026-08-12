pipeline {
    agent any

    environment {
        NODE_ENV = 'test'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                script {
                    if (isUnix()) {
                        sh 'npm ci'
                    } else {
                        bat 'npm ci'
                    }
                }
            }
        }

        stage('Run Tests') {
            steps {
                script {
                    if (isUnix()) {
                        sh 'npm test'
                    } else {
                        bat 'npm test'
                    }
                }
            }
        }

        stage('Start Application') {
            steps {
                script {
                    if (isUnix()) {
                        sh '''
                            if [ -f app.pid ]; then
                                kill "$(cat app.pid)" || true
                            fi

                            export JENKINS_NODE_COOKIE=dontKillMe
                            nohup npm start > app.log 2>&1 &
                            echo $! > app.pid

                            for i in $(seq 1 30); do
                                if curl -fsS http://localhost:3000/health; then
                                    exit 0
                                fi

                                sleep 1
                            done

                            cat app.log
                            exit 1
                        '''
                    } else {
                        bat '''
                            powershell -NoProfile -Command "$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($listener) { $listener | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }"
                            powershell -NoProfile -Command "$env:JENKINS_NODE_COOKIE = 'dontKillMe'; $p = Start-Process -FilePath npm.cmd -ArgumentList 'start' -RedirectStandardOutput app.log -RedirectStandardError app.err -PassThru -WindowStyle Hidden; $p.Id | Set-Content app.pid"
                            powershell -NoProfile -Command "$ok = $false; for ($i = 0; $i -lt 30; $i++) { try { Invoke-WebRequest -UseBasicParsing http://localhost:3000/health | Out-Null; $ok = $true; break } catch { Start-Sleep -Seconds 1 } }; if (-not $ok) { Get-Content app.log -ErrorAction SilentlyContinue; Get-Content app.err -ErrorAction SilentlyContinue; exit 1 }"
                        '''
                    }
                }
            }
        }

        stage('Archive Project') {
            steps {
                archiveArtifacts artifacts: 'src/**, public/**, package.json, package-lock.json, app.log, app.err', allowEmptyArchive: true, fingerprint: true
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully.'
        }

        failure {
            echo 'Pipeline failed. Check the Jenkins logs.'
        }
    }
}
