allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
    
    val configureAndroid: (Project) -> Unit = { p ->
        if (p.hasProperty("android")) {
            val android = p.extensions.getByName("android") as com.android.build.gradle.BaseExtension
            
            // Force SDK 35 for all plugins
            try {
                android.compileSdkVersion(36)
            } catch (e: Exception) {}

            // Fix namespace if it's null or contains the forbidden 'native' keyword
            val currentNamespace = android.namespace
            if (currentNamespace == null || currentNamespace.contains(".native") || currentNamespace.contains("native.")) {
                android.namespace = if (p.name == "flutter_app_badger") {
                    "fr.g123k.flutterappbadge.flutterappbadger"
                } else {
                    val safeName = p.name.replace("_", "").replace("-", "").replace("native", "ntv")
                    "com.xildhibanka.$safeName"
                }
            }
        }
    }

    if (project.state.executed) {
        configureAndroid(project)
    } else {
        project.afterEvaluate { configureAndroid(this) }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
